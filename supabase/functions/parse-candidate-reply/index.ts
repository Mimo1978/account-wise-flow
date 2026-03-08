import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedReply {
  interest: 'yes' | 'no' | 'maybe' | 'unclear';
  availability_text: string;
  availability_date: string | null;
  preferred_contact: 'email' | 'phone' | 'either' | 'not_stated';
  questions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      shortlist_id,
      message_id,
      reply_text,
    } = await req.json();

    if (!reply_text || (!shortlist_id && !message_id)) {
      return new Response(
        JSON.stringify({ error: "reply_text and either shortlist_id or message_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Parse the reply with AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Parse this candidate reply and return JSON only:
{
  "interest": "yes" | "no" | "maybe" | "unclear",
  "availability_text": "raw availability as stated by candidate",
  "availability_date": "ISO date string (YYYY-MM-DD) or null if not specified",
  "preferred_contact": "email" | "phone" | "either" | "not_stated",
  "questions": ["array of any questions they asked"],
  "sentiment": "positive" | "neutral" | "negative"
}

Parsing guidelines:
- interest: "yes" if clearly interested/excited, "no" if declining/not interested, "maybe" if tentative/conditional, "unclear" if can't determine
- availability_text: Extract any mention of dates, availability, notice period, or timing
- availability_date: Convert to ISO date if specific date mentioned, null otherwise
- preferred_contact: Look for preferences like "call me" (phone), "email me" (email), both = either
- questions: Any questions the candidate asks back
- sentiment: Overall tone of the reply

Return ONLY valid JSON, no markdown or explanation.`,
          },
          {
            role: "user",
            content: reply_text,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      throw new Error("Failed to parse reply with AI");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract JSON from the response
    let parsed: ParsedReply;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      // Fallback
      parsed = {
        interest: 'unclear',
        availability_text: '',
        availability_date: null,
        preferred_contact: 'not_stated',
        questions: [],
        sentiment: 'neutral',
      };
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let updatedShortlistId = shortlist_id;
    let candidateName = '';
    let jobTitle = '';
    let jobId = '';

    // If message_id provided, get the shortlist_id from it
    if (message_id && !shortlist_id) {
      const { data: msg } = await supabase
        .from('outreach_messages')
        .select('shortlist_id, job_id, candidate_name')
        .eq('id', message_id)
        .single();
      
      if (msg) {
        updatedShortlistId = msg.shortlist_id;
        candidateName = msg.candidate_name || '';
        jobId = msg.job_id;
      }
    }

    // Update outreach_messages with reply data
    if (message_id) {
      const { error: msgError } = await supabase
        .from('outreach_messages')
        .update({
          reply_content: reply_text,
          replied_at: new Date().toISOString(),
          parsed_interest: parsed.interest,
          parsed_availability_text: parsed.availability_text,
          parsed_availability_date: parsed.availability_date,
          parsed_preferred_contact: parsed.preferred_contact,
          parsed_questions: parsed.questions,
          parsed_sentiment: parsed.sentiment,
        })
        .eq('id', message_id);

      if (msgError) {
        console.error("Error updating outreach_messages:", msgError);
      }
    }

    // Update job_shortlist with candidate response
    if (updatedShortlistId) {
      // Determine new status based on interest
      let newStatus = 'responded';
      if (parsed.interest === 'no') {
        newStatus = 'rejected';
      }

      const { error: shortlistError } = await supabase
        .from('job_shortlist')
        .update({
          candidate_interest: parsed.interest,
          availability_confirmed: parsed.availability_text || null,
          response_received_at: new Date().toISOString(),
          status: newStatus,
        })
        .eq('id', updatedShortlistId);

      if (shortlistError) {
        console.error("Error updating job_shortlist:", shortlistError);
      }

      // Get job title for notification
      const { data: shortlistData } = await supabase
        .from('job_shortlist')
        .select('job_id, candidates(name)')
        .eq('id', updatedShortlistId)
        .single();

      if (shortlistData) {
        if (!jobId) jobId = shortlistData.job_id;
        candidateName = (shortlistData.candidates as any)?.name || candidateName;
        
        const { data: jobData } = await supabase
          .from('jobs')
          .select('title')
          .eq('id', shortlistData.job_id)
          .single();
        
        if (jobData) {
          jobTitle = jobData.title;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed,
        shortlist_id: updatedShortlistId,
        candidate_name: candidateName,
        job_title: jobTitle,
        job_id: jobId,
        notification: {
          message: `${candidateName} replied to your ${jobTitle} outreach. They are ${
            parsed.interest === 'yes' ? 'interested' :
            parsed.interest === 'no' ? 'not interested' :
            parsed.interest === 'maybe' ? 'tentatively interested' :
            'unclear about their interest'
          }${parsed.availability_text ? ` and ${parsed.availability_text.toLowerCase().includes('available') ? '' : 'mentioned '}${parsed.availability_text}` : ''}.`,
          should_book_call: parsed.interest === 'yes' || parsed.interest === 'maybe',
          was_rejected: parsed.interest === 'no',
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-candidate-reply error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
