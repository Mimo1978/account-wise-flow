import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brief, conversation, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "questions") {
      // Generate clarifying questions based on the brief
      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
                content: `You are a senior recruitment consultant helping refine a job specification. 
Given a rough job brief, identify what's missing and generate 3-5 clarifying questions.
Return JSON only: { "questions": [ { "id": "q1", "question": "...", "hint": "..." } ] }
Focus on: seniority level, must-have vs nice-to-have skills, team structure, budget/rate, 
contract vs permanent, remote policy, start date urgency, reporting line, and key responsibilities.
Only ask about things NOT already covered in the brief.`,
              },
              {
                role: "user",
                content: `Job brief:\n\n${brief}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "return_questions",
                  description: "Return clarifying questions for the job brief",
                  parameters: {
                    type: "object",
                    properties: {
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            question: { type: "string" },
                            hint: { type: "string" },
                          },
                          required: ["id", "question", "hint"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["questions"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "return_questions" },
            },
          }),
        }
      );

      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI error:", resp.status, t);
        if (resp.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (resp.status === 402)
          return new Response(
            JSON.stringify({ error: "AI credits exhausted" }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        throw new Error("AI gateway error");
      }

      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ questions: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "refine") {
      // Generate/refine a full spec from brief + Q&A conversation
      const qaContext = (conversation || [])
        .map(
          (c: { question: string; answer: string }) =>
            `Q: ${c.question}\nA: ${c.answer}`
        )
        .join("\n\n");

      const resp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
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
                content: `You are a senior recruitment consultant. Generate a comprehensive, professional job specification from the brief and Q&A answers provided.

Structure the spec clearly with these sections:
## Role Overview
## Key Responsibilities
## Required Skills & Experience
## Nice-to-Have
## Package & Benefits
## Working Arrangements
## About the Team

Use bullet points. Be specific and actionable. Write in a professional but approachable tone.
If information is missing for a section, omit that section rather than guessing.
Return the spec as plain markdown text.`,
              },
              {
                role: "user",
                content: `Original brief:\n${brief}\n\nAdditional context from Q&A:\n${qaContext || "None provided"}`,
              },
            ],
          }),
        }
      );

      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI error:", resp.status, t);
        if (resp.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (resp.status === 402)
          return new Response(
            JSON.stringify({ error: "AI credits exhausted" }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        throw new Error("AI gateway error");
      }

      const data = await resp.json();
      const spec = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ spec }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'questions' or 'refine'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("ai-refine-spec error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
