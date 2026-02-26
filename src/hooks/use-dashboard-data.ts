import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmOpportunity, CrmInvoice, CrmActivity } from "@/types/crm";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  addDays,
} from "date-fns";

const FIVE_MINUTES = 5 * 60 * 1000;

function fromOpps() { return supabase.from("crm_opportunities" as any); }
function fromInvoices() { return supabase.from("crm_invoices" as any); }
function fromActivities() { return supabase.from("crm_activities" as any); }
function fromCompanies() { return supabase.from("crm_companies" as any); }

// ---------- KPIs ----------

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now).toISOString();
      const thisMonthEnd = endOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const [oppsRes, invoicesRes, lastMonthInvoicesRes] = await Promise.all([
        fromOpps().select("value, probability, stage"),
        fromInvoices().select("total, status, due_date, paid_at, currency"),
        fromInvoices()
          .select("total, status, paid_at")
          .eq("status", "paid")
          .gte("paid_at", lastMonthStart)
          .lte("paid_at", lastMonthEnd),
      ]);

      const opps = (oppsRes.data ?? []) as any[];
      const invoices = (invoicesRes.data ?? []) as any[];
      const lastMonthPaidInvoices = (lastMonthInvoicesRes.data ?? []) as any[];

      // Open pipeline (non-closed)
      const openOpps = opps.filter(
        (o) => o.stage !== "closed_won" && o.stage !== "closed_lost"
      );
      const openPipeline = openOpps.reduce((s, o) => s + (o.value || 0), 0);
      const weightedPipeline = openOpps.reduce(
        (s, o) => s + (o.value || 0) * ((o.probability || 0) / 100),
        0
      );

      // Revenue this month
      const paidThisMonth = invoices.filter(
        (i) =>
          i.status === "paid" &&
          i.paid_at &&
          i.paid_at >= thisMonthStart &&
          i.paid_at <= thisMonthEnd
      );
      const revenueThisMonth = paidThisMonth.reduce(
        (s, i) => s + (i.total || 0),
        0
      );
      const revenueLastMonth = lastMonthPaidInvoices.reduce(
        (s, i) => s + (i.total || 0),
        0
      );

      // Overdue invoices
      const today = format(now, "yyyy-MM-dd");
      const overdueInvoices = invoices.filter(
        (i) =>
          i.status === "sent" &&
          i.due_date &&
          i.due_date < today
      );
      const overdueCount = overdueInvoices.length;
      const overdueValue = overdueInvoices.reduce(
        (s, i) => s + (i.total || 0),
        0
      );

      return {
        openPipeline,
        weightedPipeline,
        revenueThisMonth,
        revenueLastMonth,
        revenueChange:
          revenueLastMonth > 0
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
            : revenueThisMonth > 0
            ? 100
            : 0,
        overdueCount,
        overdueValue,
      };
    },
  });
}

// ---------- Pipeline by Stage ----------

export function usePipelineByStage() {
  return useQuery({
    queryKey: ["dashboard-pipeline-stage"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const { data } = await fromOpps().select("stage, value");
      const stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
      const stageLabels: Record<string, string> = {
        lead: "Lead",
        qualified: "Qualified",
        proposal: "Proposal",
        negotiation: "Negotiation",
        closed_won: "Won",
        closed_lost: "Lost",
      };
      const map = new Map<string, number>();
      for (const o of (data ?? []) as any[]) {
        map.set(o.stage, (map.get(o.stage) || 0) + (o.value || 0));
      }
      return stages.map((s) => ({
        stage: stageLabels[s] || s,
        value: map.get(s) || 0,
      }));
    },
  });
}

// ---------- Revenue Trend (12 months) ----------

export function useRevenueTrend() {
  return useQuery({
    queryKey: ["dashboard-revenue-trend"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const now = new Date();
      const start = startOfMonth(subMonths(now, 11)).toISOString();
      const { data } = await fromInvoices()
        .select("total, paid_at")
        .eq("status", "paid")
        .gte("paid_at", start);

      const months: { month: string; revenue: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(now, i);
        const label = format(m, "MMM yy");
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        const total = ((data ?? []) as any[])
          .filter(
            (inv) =>
              inv.paid_at &&
              new Date(inv.paid_at) >= mStart &&
              new Date(inv.paid_at) <= mEnd
          )
          .reduce((s, inv) => s + (inv.total || 0), 0);
        months.push({ month: label, revenue: total });
      }
      return months;
    },
  });
}

// ---------- Win Rate (90 days) ----------

export function useWinRate() {
  return useQuery({
    queryKey: ["dashboard-win-rate"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const ninetyDaysAgo = subMonths(new Date(), 3).toISOString();
      const { data } = await fromOpps()
        .select("stage, updated_at")
        .in("stage", ["closed_won", "closed_lost"])
        .gte("updated_at", ninetyDaysAgo);

      const won = ((data ?? []) as any[]).filter((o) => o.stage === "closed_won").length;
      const lost = ((data ?? []) as any[]).filter((o) => o.stage === "closed_lost").length;
      return { won, lost, total: won + lost, rate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0 };
    },
  });
}

// ---------- Activity by Type (30 days) ----------

export function useActivityByType() {
  return useQuery({
    queryKey: ["dashboard-activity-type"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const thirtyDaysAgo = subMonths(new Date(), 1).toISOString();
      const { data } = await fromActivities()
        .select("type")
        .gte("created_at", thirtyDaysAgo);

      const map = new Map<string, number>();
      for (const a of (data ?? []) as any[]) {
        map.set(a.type, (map.get(a.type) || 0) + 1);
      }
      const types = ["call", "email", "sms", "meeting"];
      return types.map((t) => ({
        type: t.charAt(0).toUpperCase() + t.slice(1),
        count: map.get(t) || 0,
      }));
    },
  });
}

// ---------- Recent Activities ----------

export function useRecentActivities() {
  return useQuery({
    queryKey: ["dashboard-recent-activities"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const { data, error } = await fromActivities()
        .select("*, crm_contacts(first_name, last_name), crm_companies(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ---------- Upcoming Tasks ----------

export function useUpcomingTasks() {
  return useQuery({
    queryKey: ["dashboard-upcoming-tasks"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const now = new Date().toISOString();
      const nextWeek = addDays(new Date(), 7).toISOString();
      const { data, error } = await fromActivities()
        .select("*, crm_contacts(first_name, last_name)")
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", now)
        .lte("scheduled_at", nextWeek)
        .order("scheduled_at", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ---------- Deals Closing This Month ----------

export function useDealsClosingThisMonth() {
  return useQuery({
    queryKey: ["dashboard-deals-closing"],
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    queryFn: async () => {
      const now = new Date();
      const mStart = format(startOfMonth(now), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const { data, error } = await fromOpps()
        .select("*, crm_companies(name)")
        .gte("expected_close_date", mStart)
        .lte("expected_close_date", mEnd)
        .not("stage", "in", '("closed_won","closed_lost")')
        .order("expected_close_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
