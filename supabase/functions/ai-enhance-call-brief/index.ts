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

    const sys = `You enhance short call briefs into clear, natural AI-voice agent instructions.

Rules:
- Output ONLY the enhanced script/instruction text. No preamble, no markdown, no headings.
- Keep it concise (90–160 words).
- Use a warm, professional tone — first-person as the AI agent calling on behalf of ${agency_name || "the agency"}.
- Open with a greeting using the contact's first name${contact_name ? ` ("${contact_name}")` : ""}.
- State the purpose clearly within the first two sentences.
- Include natural pauses for the contact to respond (use short sentences, no "[pause]" markers — Bland.ai/Twilio pace naturally).
- End with a clear next step (book a meeting, confirm callback time, etc.).
- Never invent facts not in the brief.
- Do not use emojis or special formatting.`;

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