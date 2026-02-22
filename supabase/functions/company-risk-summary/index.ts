import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Deterministic risk scoring rules ──

const RISK_WEIGHTS = {
  DORMANT_60_DAYS: 40,
  SINGLE_CONTACT: 30,
  NO_EXECUTIVE: 20,
  SNOOZED_OR_OPTED_OUT: 10,
} as const;

const SENIOR_TITLES = [
  "ceo", "cfo", "cto", "coo", "vp", "director", "head",
  "president", "chief", "managing partner", "partner",
];

function isSenior(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return SENIOR_TITLES.some((s) => lower.includes(s));
}

type RiskBand = "healthy" | "medium_risk" | "high_risk";

function riskBand(score: number): RiskBand {
  if (score <= 20) return "healthy";
  if (score <= 50) return "medium_risk";
  return "high_risk";
}

interface CompanyRiskResult {
  company_id: string;
  company_name: string;
  risk_score: number;
  risk_band: RiskBand;
  reasons: string[];
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional single-company filter
    const url = new URL(req.url);
    const filterCompanyId = url.searchParams.get("company_id");

    // 1. Fetch companies + contacts
    let companiesQuery = supabase
      .from("companies")
      .select("id, name, contacts:contacts(id, title, updated_at)");

    if (filterCompanyId) {
      companiesQuery = companiesQuery.eq("id", filterCompanyId);
    }

    const { data: companies, error: compErr } = await companiesQuery;
    if (compErr) throw compErr;

    // 2. Fetch outreach targets that are snoozed or opted-out per company contact
    const { data: negativeTargets, error: tgtErr } = await supabase
      .from("outreach_targets")
      .select("contact_id, state:state, do_not_contact")
      .or("state.eq.snoozed,do_not_contact.eq.true");
    if (tgtErr) throw tgtErr;

    const negativeContactIds = new Set(
      (negativeTargets || []).map((t: any) => t.contact_id).filter(Boolean)
    );

    const now = Date.now();
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    const results: CompanyRiskResult[] = (companies || []).map((company: any) => {
      const contacts = Array.isArray(company.contacts) ? company.contacts : [];
      let score = 0;
      const reasons: string[] = [];

      // Rule 1: No activity in 60 days
      if (contacts.length === 0) {
        score += RISK_WEIGHTS.DORMANT_60_DAYS;
        reasons.push("No contacts — dormant");
      } else {
        const lastUpdate = Math.max(
          ...contacts.map((c: any) => new Date(c.updated_at).getTime())
        );
        if (now - lastUpdate > sixtyDaysMs) {
          score += RISK_WEIGHTS.DORMANT_60_DAYS;
          reasons.push("No activity in 60+ days");
        }
      }

      // Rule 2: Only 1 contact
      if (contacts.length <= 1) {
        score += RISK_WEIGHTS.SINGLE_CONTACT;
        reasons.push(
          contacts.length === 0
            ? "No contacts mapped"
            : "Only 1 contact mapped"
        );
      }

      // Rule 3: No executive title
      const hasSenior = contacts.some((c: any) => isSenior(c.title));
      if (!hasSenior) {
        score += RISK_WEIGHTS.NO_EXECUTIVE;
        reasons.push("No executive-level contact");
      }

      // Rule 4: Snoozed / opted-out outreach target exists
      const hasNegative = contacts.some((c: any) =>
        negativeContactIds.has(c.id)
      );
      if (hasNegative) {
        score += RISK_WEIGHTS.SNOOZED_OR_OPTED_OUT;
        reasons.push("Snoozed or opted-out outreach target");
      }

      return {
        company_id: company.id,
        company_name: company.name,
        risk_score: score,
        risk_band: riskBand(score),
        reasons,
      };
    });

    return new Response(JSON.stringify({ data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("company-risk-summary error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
