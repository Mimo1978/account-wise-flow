import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * AI Script Assist
 * Modes:
 *  - "polish": fix spelling, grammar and tighten copy. Preserve {{variables}}.
 *  - "link_job": rewrite a script to reference a linked job's headline details
 *    while anonymising the company to a tier descriptor (e.g. "a top-tier
 *    investment bank") until the candidate confirms interest + availability.
 */

type Mode = "polish" | "link_job" | "proofread";

interface Body {
  mode: Mode;
  channel: "email" | "sms" | "call";
  subject?: string;
  body?: string;
  call_blocks?: Array<{ id: string; type: string; title: string; content: string }>;
  job_id?: string;
  agency_name?: string;
  /** For proofread mode: arbitrary list of named text fields to check. */
  fields?: Array<{ id: string; label: string; text: string }>;
}

function tierDescriptor(industry: string | null, name: string): string {
  const ind = (industry || "").toLowerCase();
  if (/bank|capital|invest/.test(ind)) return "a top-tier investment bank";
  if (/fintech/.test(ind)) return "a leading fintech";
  if (/insur/.test(ind)) return "a major insurer";
  if (/consult/.test(ind)) return "a leading consultancy";
  if (/health|pharma|bio/.test(ind)) return "a leading healthcare organisation";
  if (/tech|software|saas|cloud/.test(ind)) return "a leading technology firm";
  if (/retail|consumer/.test(ind)) return "a major retail group";
  if (/energy|oil|gas|renew/.test(ind)) return "a leading energy company";
  if (/government|public/.test(ind)) return "a major public-sector organisation";
  if (name) return "a leading client";
  return "a leading client";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "ai_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Body;
    if (!payload?.mode) {
      return new Response(JSON.stringify({ error: "mode is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build job context if linking
    let jobContext = "";
    let anonCompany = "a leading client";
    let jobMeta: Record<string, unknown> | null = null;
    if (payload.mode === "link_job" && payload.job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("title, location, job_type, salary_min, salary_max, salary_currency, spec_seniority, spec_must_have_skills, spec_sectors, companies(name, industry)")
        .eq("id", payload.job_id)
        .maybeSingle();
      if (job) {
        const co = (job as any).companies || {};
        anonCompany = tierDescriptor(co.industry ?? null, co.name ?? "");
        const rate =
          job.salary_min && job.salary_max
            ? `${job.salary_currency || "GBP"} ${job.salary_min}-${job.salary_max}`
            : "competitive";
        jobMeta = {
          title: job.title,
          anon_company: anonCompany,
          location: job.location || "",
          job_type: job.job_type || "",
          rate,
          seniority: job.spec_seniority || "",
          must_have: (job.spec_must_have_skills || []).slice(0, 5),
          sectors: (job.spec_sectors || []).slice(0, 3),
        };
        jobContext = `JOB DETAILS (use these — but NEVER reveal the real company name):
- Role: ${job.title}
- Anonymised company descriptor: "${anonCompany}"
- Location: ${job.location || "not specified"}
- Type: ${job.job_type || "not specified"}
- Rate: ${rate}
- Seniority: ${job.spec_seniority || "not specified"}
- Key skills: ${(job.spec_must_have_skills || []).slice(0, 5).join(", ") || "n/a"}
- Sectors: ${(job.spec_sectors || []).slice(0, 3).join(", ") || "n/a"}

ANONYMISATION RULE: Never use the literal company name. Use the descriptor "${anonCompany}".
The real company is only revealed AFTER the candidate has expressed interest AND confirmed availability.`;
      }
    }

    // Build the input the AI must rewrite
    const channelDescription =
      payload.channel === "sms"
        ? "An SMS message — keep under 160 characters. No greeting line breaks."
        : payload.channel === "call"
        ? "A phone call script broken into blocks (intro, permission, questions, branching, close). Keep blocks conversational and concise — what the recruiter SAYS out loud."
        : "A professional email — short paragraphs, friendly British English tone, clear single call-to-action.";

    const systemPrompt = `You are an elite recruitment copywriter and editor for Client Mapper.
Your job is to rewrite recruitment outreach scripts so they are:
- grammatically correct, professionally polished British English
- warm, human, and concise (no jargon, no clichés like "exciting opportunity")
- compliant: no false claims of being "registered with us" or "consented", no salary guarantees
- preserve EVERY {{variable}} placeholder exactly (do not invent new variables, do not remove existing ones unless instructed)

CHANNEL: ${channelDescription}

${payload.agency_name ? `AGENCY: The recruiter is calling on behalf of "${payload.agency_name}". Use the {{agency.name}} variable when introducing the firm so it stays editable. Do NOT hard-code the agency name.` : "AGENCY: Use the {{agency.name}} variable wherever the recruiter introduces their firm — never hard-code an agency name."}

${jobContext}

Return ONLY valid JSON matching the requested schema. Do not include commentary.`;

    let userPrompt = "";
    let toolSchema: Record<string, unknown>;

    if (payload.channel === "call") {
      const blocks = payload.call_blocks || [];
      userPrompt = `Rewrite the following call blocks. ${
        payload.mode === "link_job"
          ? "Weave the linked job details (anonymised) into the intro, permission and questions blocks where natural. Add a closing line confirming you'll share the company name once they've confirmed interest and availability."
          : "Fix spelling, grammar, awkward phrasing. Tighten where wordy. Keep the same block structure and intent."
      }

CURRENT BLOCKS:
${JSON.stringify(blocks, null, 2)}`;
      toolSchema = {
        type: "object",
        properties: {
          call_blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["id", "type", "title", "content"],
              additionalProperties: false,
            },
          },
          summary: { type: "string", description: "One-line summary of changes made" },
        },
        required: ["call_blocks", "summary"],
        additionalProperties: false,
      };
    } else {
      userPrompt = `Rewrite the following ${payload.channel} script. ${
        payload.mode === "link_job"
          ? "Weave the linked job details (anonymised) into the body where natural. Reference the role, location, rate range and headline skill — but NEVER name the real company. End with a clear next step."
          : "Fix spelling, grammar, awkward phrasing. Tighten where wordy. Preserve the original intent and tone."
      }

${payload.channel === "email" ? `CURRENT SUBJECT: ${payload.subject || "(none)"}` : ""}
CURRENT BODY:
${payload.body || ""}`;
      toolSchema = {
        type: "object",
        properties: {
          subject:
            payload.channel === "email"
              ? { type: "string", description: "Improved subject line" }
              : { type: "string" },
          body: { type: "string", description: "The rewritten message body" },
          summary: { type: "string", description: "One-line summary of changes made" },
        },
        required: ["body", "summary"],
        additionalProperties: false,
      };
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_script",
              description: "Return the rewritten script.",
              parameters: toolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_script" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "AI is busy. Please retry in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "credits_required", message: "AI credits exhausted. Top up in Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error", aiRes.status, text);
      return new Response(JSON.stringify({ error: "ai_error", detail: text.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "ai_no_output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = JSON.parse(argsStr);

    return new Response(
      JSON.stringify({
        success: true,
        mode: payload.mode,
        channel: payload.channel,
        anon_company: anonCompany,
        job: jobMeta,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-script-assist error:", msg);
    return new Response(JSON.stringify({ error: "server_error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});