import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InboundPayload {
  workspace_id: string;
  campaign_id?: string;
  target_id?: string;
  candidate_id?: string;
  contact_id?: string;
  channel: "email" | "sms" | "voicemail" | "other";
  raw_content: string;
  sender_identifier?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: InboundPayload = await req.json();

    // 1. Insert inbound response record
    const { data: response, error: insertError } = await supabase
      .from("outreach_inbound_responses")
      .insert({
        workspace_id: payload.workspace_id,
        campaign_id: payload.campaign_id,
        target_id: payload.target_id,
        candidate_id: payload.candidate_id,
        contact_id: payload.contact_id,
        channel: payload.channel,
        raw_content: payload.raw_content,
        sender_identifier: payload.sender_identifier,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. AI Classification using Lovable AI (Gemini Flash for speed)
    const aiPrompt = `You are an AI assistant classifying inbound outreach responses.

Analyze this ${payload.channel} response and classify it:

---
${payload.raw_content}
---

Return a JSON object with:
- intent: one of "interested", "not_interested", "meeting_request", "callback_request", "info_request", "opt_out", "out_of_office", "forwarded", "unclassified"
- sentiment: one of "positive", "neutral", "negative"
- summary: 1-2 sentence summary of the response
- confidence: number 0.0 to 1.0
- follow_up_type: one of "meeting", "call", "email", "none"
- suggested_reply: brief suggested acknowledgment if appropriate

Return ONLY valid JSON, no markdown.`;

    const aiResponse = await fetch("https://gnlfygkqsczpncjiyatv.supabase.co/functions/v1/ai-knowledge-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: aiPrompt }],
        model: "google/gemini-2.5-flash",
      }),
    });

    let classification = {
      intent: "unclassified" as string,
      sentiment: "neutral" as string,
      summary: "Could not classify response",
      confidence: 0,
      follow_up_type: "none" as string,
    };

    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || aiData.reply || "";
        const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        classification = JSON.parse(cleanJson);
      } catch {
        console.error("Failed to parse AI classification");
      }
    }

    // 3. Update the inbound response with AI classification
    await supabase
      .from("outreach_inbound_responses")
      .update({
        ai_intent: classification.intent,
        ai_sentiment: classification.sentiment,
        ai_summary: classification.summary,
        ai_confidence: classification.confidence,
        ai_processed_at: new Date().toISOString(),
        ai_raw_analysis: classification,
        follow_up_type: classification.follow_up_type,
        status: "classified",
      })
      .eq("id", response.id);

    // 4. Update target state based on classification
    if (payload.target_id) {
      const stateMap: Record<string, string> = {
        interested: "responded",
        meeting_request: "booked",
        callback_request: "responded",
        opt_out: "opted_out",
        not_interested: "responded",
      };
      const newState = stateMap[classification.intent];
      if (newState) {
        await supabase
          .from("outreach_targets")
          .update({ state: newState })
          .eq("id", payload.target_id);
      }

      // Log outreach event
      await supabase.from("outreach_events").insert({
        workspace_id: payload.workspace_id,
        campaign_id: payload.campaign_id,
        target_id: payload.target_id,
        candidate_id: payload.candidate_id,
        contact_id: payload.contact_id,
        event_type: "responded",
        channel: payload.channel,
        subject: `AI Classified: ${classification.intent}`,
        body: classification.summary,
        metadata: {
          ai_intent: classification.intent,
          ai_sentiment: classification.sentiment,
          ai_confidence: classification.confidence,
          inbound_response_id: response.id,
        },
      });
    }

    // 5. If meeting/callback requested, check automation settings and create scheduled action
    if (
      (classification.intent === "meeting_request" || classification.intent === "callback_request") &&
      payload.campaign_id
    ) {
      const { data: autoSettings } = await supabase
        .from("outreach_automation_settings")
        .select("*")
        .eq("campaign_id", payload.campaign_id)
        .single();

      if (autoSettings?.auto_schedule_meetings || autoSettings?.auto_schedule_callbacks) {
        // Check premium subscription
        const { data: isPremium } = await supabase.rpc("is_premium_workspace", {
          _workspace_id: payload.workspace_id,
        });

        if (isPremium) {
          const actionType = classification.intent === "meeting_request" ? "calendar_booking" : "callback";
          const scheduledFor = new Date();
          scheduledFor.setDate(scheduledFor.getDate() + 1); // Default: next day
          scheduledFor.setHours(10, 0, 0, 0);

          await supabase.from("outreach_scheduled_actions").insert({
            workspace_id: payload.workspace_id,
            campaign_id: payload.campaign_id,
            target_id: payload.target_id,
            inbound_response_id: response.id,
            action_type: actionType,
            scheduled_for: scheduledFor.toISOString(),
            requires_approval: !autoSettings.require_human_approval ? false : true,
            calendar_connection_id: autoSettings.preferred_calendar_connection_id,
            meeting_title: `Follow-up: ${classification.intent === "meeting_request" ? "Meeting" : "Callback"}`,
            meeting_duration_minutes: autoSettings.default_meeting_duration || 30,
            meeting_notes: classification.summary,
          });

          // Update inbound response follow-up status
          await supabase
            .from("outreach_inbound_responses")
            .update({
              follow_up_status: autoSettings.require_human_approval ? "pending" : "scheduled",
              status: "actioned",
              actioned_at: new Date().toISOString(),
            })
            .eq("id", response.id);
        }
      }
    }

    // 6. Log feedback on candidate/contact record via notes
    if (payload.candidate_id || payload.contact_id) {
      const noteContent = `📥 **Inbound ${payload.channel} Response**\n\n` +
        `**Intent:** ${classification.intent}\n` +
        `**Sentiment:** ${classification.sentiment}\n` +
        `**Summary:** ${classification.summary}\n` +
        `**Confidence:** ${Math.round(classification.confidence * 100)}%`;

      if (payload.candidate_id) {
        await supabase.from("candidate_notes").insert({
          candidate_id: payload.candidate_id,
          body: noteContent,
          title: `AI Response Analysis - ${classification.intent}`,
          owner_id: user.id,
          visibility: "team",
          tags: ["ai-analysis", "outreach-response", classification.intent],
        });
      }

      if (payload.contact_id) {
        await supabase.from("notes").insert({
          entity_type: "contact",
          entity_id: payload.contact_id,
          content: noteContent,
          owner_id: user.id,
          visibility: "team",
          source: "api",
          team_id: payload.workspace_id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        response_id: response.id,
        classification: {
          intent: classification.intent,
          sentiment: classification.sentiment,
          summary: classification.summary,
          confidence: classification.confidence,
          follow_up_type: classification.follow_up_type,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing inbound response:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
