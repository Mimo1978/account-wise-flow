import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  purpose: string;
  brief: string;
  contact_name?: string;
  company_name?: string;
  agency_name?: string;
  provider?: "bland" | "twilio";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "ai_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { purpose, brief, contact_name, company_name, agency_name, provider } = (await req.json()) as Body;

    const sys = `You turn short call briefs into a CONVERSATIONAL script for an AI VOICE agent (Bland.ai / Twilio).

Critical — this is NOT a monologue. The AI must talk like a human calling: it says ONE thought, then STOPS and listens.

Output format — a turn-by-turn script using these exact labels, one per line:
AGENT: <one short spoken sentence, 1–2 lines max>
WAIT_FOR_RESPONSE: <what we expect the person to say or do>
AGENT: <short follow-up, acknowledging or pivoting>
WAIT_FOR_RESPONSE: ...
(repeat until the goal is reached)

Hard rules:
- NEVER let an AGENT turn dump the whole pitch. Break it into 4–8 small turns with WAIT_FOR_RESPONSE between each.
- Each AGENT line is spoken aloud — keep it under ~25 words, plain speech, contractions OK.
- Open warmly, greet using the contact's first name${contact_name ? ` ("${contact_name}")` : ""}, and check "is now a good time?" — then WAIT.
- State the reason for the call in the NEXT turn, not the first. Calling on behalf of ${agency_name || "the agency"}.
- Include natural filler / acknowledgements between turns ("Got it.", "Makes sense.", "Thanks for that.").
- End with a single concrete next step (book a slot, confirm callback time, send an email) — then one final WAIT_FOR_RESPONSE to capture confirmation.
- If they say "not a good time" early on, have a polite fallback AGENT line offering a callback.
- Never invent facts outside the brief. No markdown, no emojis, no headings, no commentary — ONLY the AGENT/WAIT_FOR_RESPONSE lines.`;

    const user = `Purpose: ${purpose}
${company_name ? `Company: ${company_name}\n` : ""}Brief from the user:
"""
${brief || "(no extra context provided)"}
"""

Write the enhanced AI agent script.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "AI is busy — try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "credits", message: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "ai_error", message: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const enhanced = data?.choices?.[0]?.message?.content?.trim() || "";
    return new Response(JSON.stringify({ enhanced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", message: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});