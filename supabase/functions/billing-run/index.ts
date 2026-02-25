import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BillingPlan {
  id: string;
  workspace_id: string;
  engagement_id: string;
  company_id: string;
  plan_name: string;
  plan_type: string;
  status: string;
  frequency: string;
  currency: string;
  billing_mode: string;
  fixed_amount: number | null;
  day_rate: number | null;
  included_days: number | null;
  estimated_days: number | null;
  vat_rate: number | null;
  po_number: string | null;
  invoice_day_of_month: number | null;
  next_run_date: string | null;
  last_run_at: string | null;
  end_date: string | null;
}

function computePeriod(plan: BillingPlan, referenceDate: Date): { start: Date; end: Date } {
  const freq = plan.frequency;
  const dayOfMonth = plan.invoice_day_of_month ?? 1;

  if (freq === "monthly") {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // last day of month
    return { start, end };
  }
  if (freq === "weekly") {
    const dayOfWeek = referenceDate.getDay();
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }
  if (freq === "biweekly") {
    const dayOfWeek = referenceDate.getDay();
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    return { start, end };
  }
  if (freq === "quarterly") {
    const year = referenceDate.getFullYear();
    const quarter = Math.floor(referenceDate.getMonth() / 3);
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0);
    return { start, end };
  }
  // milestone — use reference date as both
  return { start: referenceDate, end: referenceDate };
}

function computeAmount(plan: BillingPlan): number {
  if (plan.billing_mode === "fixed" && plan.fixed_amount != null) {
    return plan.fixed_amount;
  }
  if (plan.billing_mode === "day_rate" && plan.day_rate != null) {
    const days = plan.included_days ?? plan.estimated_days ?? 0;
    return plan.day_rate * days;
  }
  if (plan.billing_mode === "estimate") {
    if (plan.fixed_amount != null) return plan.fixed_amount;
    if (plan.day_rate != null && plan.estimated_days != null) {
      return plan.day_rate * plan.estimated_days;
    }
  }
  return 0;
}

function advanceNextRun(plan: BillingPlan, currentRunDate: Date): string {
  const next = new Date(currentRunDate);
  switch (plan.frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      if (plan.invoice_day_of_month) {
        next.setDate(Math.min(plan.invoice_day_of_month, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    default:
      // milestone — no auto-advance
      return currentRunDate.toISOString().slice(0, 10);
  }
  return next.toISOString().slice(0, 10);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Use service role client for mutations (bypasses RLS for insert into invoice_runs)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { workspace_id, mode, billing_plan_id } = body;

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify user belongs to workspace
    const { data: roleCheck } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("team_id", workspace_id)
      .maybeSingle();

    if (!roleCheck || !["admin", "manager"].includes(roleCheck.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: admin or manager role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const today = new Date();
    const todayStr = formatDate(today);

    // Fetch applicable billing plans
    let plansQuery = serviceClient
      .from("billing_plans")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("status", "active");

    if (mode === "single_plan" && billing_plan_id) {
      plansQuery = plansQuery.eq("id", billing_plan_id);
    } else {
      // due_plans mode: only plans where next_run_date <= today
      plansQuery = plansQuery.lte("next_run_date", todayStr).not("next_run_date", "is", null);
    }

    const { data: plans, error: plansError } = await plansQuery;
    if (plansError) throw plansError;

    let created_count = 0;
    let skipped_count = 0;
    let failed_count = 0;
    const results: Array<{ plan_id: string; status: string; error?: string }> = [];

    for (const plan of (plans ?? []) as BillingPlan[]) {
      try {
        // Skip plans past end_date
        if (plan.end_date && plan.end_date < todayStr) {
          skipped_count++;
          results.push({ plan_id: plan.id, status: "skipped", error: "past end_date" });
          continue;
        }

        const referenceDate = plan.next_run_date ? new Date(plan.next_run_date) : today;
        const period = computePeriod(plan, referenceDate);
        const periodStart = formatDate(period.start);
        const periodEnd = formatDate(period.end);
        const dedupeKey = `${workspace_id}:${plan.id}:${periodStart}:${periodEnd}`;

        // Check for existing run (idempotency)
        const { data: existingRun } = await serviceClient
          .from("invoice_runs")
          .select("id")
          .eq("workspace_id", workspace_id)
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        if (existingRun) {
          skipped_count++;
          results.push({ plan_id: plan.id, status: "skipped", error: "already_run" });
          continue;
        }

        const amount = computeAmount(plan);
        if (amount <= 0) {
          skipped_count++;
          results.push({ plan_id: plan.id, status: "skipped", error: "zero_amount" });
          continue;
        }

        // Compute due date: 14 days from today
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 14);

        const invoiceNotes = `Auto invoice — ${plan.plan_name} — ${periodStart} to ${periodEnd}`;

        // Create invoice
        const { data: invoice, error: invoiceError } = await serviceClient
          .from("invoices")
          .insert({
            workspace_id: plan.workspace_id,
            company_id: plan.company_id,
            engagement_id: plan.engagement_id,
            amount,
            currency: plan.currency,
            status: "draft",
            due_date: formatDate(dueDate),
            issued_date: todayStr,
            notes: invoiceNotes,
          })
          .select("id")
          .single();

        if (invoiceError) throw invoiceError;

        // Create invoice_run record
        const { error: runError } = await serviceClient
          .from("invoice_runs")
          .insert({
            workspace_id: plan.workspace_id,
            billing_plan_id: plan.id,
            engagement_id: plan.engagement_id,
            period_start: periodStart,
            period_end: periodEnd,
            dedupe_key: dedupeKey,
            invoice_id: invoice.id,
            status: "created",
          });

        if (runError) throw runError;

        // Advance next_run_date and update last_run_at
        const nextRunDate = advanceNextRun(plan, referenceDate);
        await serviceClient
          .from("billing_plans")
          .update({
            last_run_at: new Date().toISOString(),
            next_run_date: nextRunDate,
          })
          .eq("id", plan.id);

        created_count++;
        results.push({ plan_id: plan.id, status: "created" });
      } catch (planError: any) {
        failed_count++;
        results.push({ plan_id: plan.id, status: "failed", error: planError.message });

        // Record failed run
        const period = computePeriod(plan, today);
        const dedupeKey = `${workspace_id}:${plan.id}:${formatDate(period.start)}:${formatDate(period.end)}`;
        await serviceClient.from("invoice_runs").upsert(
          {
            workspace_id: plan.workspace_id,
            billing_plan_id: plan.id,
            engagement_id: plan.engagement_id,
            period_start: formatDate(period.start),
            period_end: formatDate(period.end),
            dedupe_key: dedupeKey,
            status: "failed",
            error_message: planError.message,
          },
          { onConflict: "workspace_id,dedupe_key" }
        );
      }
    }

    return new Response(
      JSON.stringify({
        created_count,
        skipped_count,
        failed_count,
        total_plans: (plans ?? []).length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
