import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from "date-fns";

const FIVE_MINUTES = 5 * 60 * 1000;

function fromOpps() { return supabase.from("crm_opportunities" as any); }
function fromInvoices() { return supabase.from("crm_invoices" as any); }
function fromActivities() { return supabase.from("crm_activities" as any); }
function fromCompanies() { return supabase.from("crm_companies" as any); }
function fromProjects() { return supabase.from("crm_projects" as any); }
function fromContacts() { return supabase.from("crm_contacts" as any); }

// Sales Pipeline Report
export function useSalesPipelineReport() {
  return useQuery({
    queryKey: ["report-sales-pipeline"],
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data } = await fromOpps().select("stage, value, probability, created_at, updated_at");
      const opps = (data ?? []) as any[];

      const stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
      const stageLabels: Record<string, string> = {
        lead: "Lead", qualified: "Qualified", proposal: "Proposal",
        negotiation: "Negotiation", closed_won: "Closed Won", closed_lost: "Closed Lost",
      };

      const result = stages.map((stage) => {
        const stageOpps = opps.filter((o) => o.stage === stage);
        const count = stageOpps.length;
        const totalValue = stageOpps.reduce((s, o) => s + (o.value || 0), 0);
        const avgDealSize = count > 0 ? totalValue / count : 0;
        return {
          stage,
          label: stageLabels[stage] || stage,
          count,
          totalValue,
          avgDealSize,
        };
      });

      // Conversion rates
      const withConversion = result.map((r, i) => ({
        ...r,
        conversionRate: i > 0 && result[i - 1].count > 0
          ? Math.round((r.count / result[i - 1].count) * 100)
          : null,
      }));

      return withConversion;
    },
  });
}

// Revenue Report (12 months)
export function useRevenueReport() {
  return useQuery({
    queryKey: ["report-revenue"],
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const now = new Date();
      const start = startOfMonth(subMonths(now, 11)).toISOString();

      const [sentRes, paidRes] = await Promise.all([
        fromInvoices().select("total, issue_date, status").gte("issue_date", start.slice(0, 10)),
        fromInvoices().select("total, paid_at, status").eq("status", "paid").gte("paid_at", start),
      ]);

      const sentInvoices = (sentRes.data ?? []) as any[];
      const paidInvoices = (paidRes.data ?? []) as any[];

      const months = [];
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(now, i);
        const label = format(m, "MMM yyyy");
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);

        const sentThisMonth = sentInvoices.filter(
          (inv) => inv.issue_date && new Date(inv.issue_date) >= mStart && new Date(inv.issue_date) <= mEnd
        );
        const paidThisMonth = paidInvoices.filter(
          (inv) => inv.paid_at && new Date(inv.paid_at) >= mStart && new Date(inv.paid_at) <= mEnd
        );
        const paidTotal = paidThisMonth.reduce((s, inv) => s + (inv.total || 0), 0);

        months.push({
          month: label,
          invoicesSent: sentThisMonth.length,
          invoicesPaid: paidThisMonth.length,
          totalValue: paidTotal,
          avgInvoiceValue: paidThisMonth.length > 0 ? paidTotal / paidThisMonth.length : 0,
        });
      }
      return months;
    },
  });
}

// Activity Report
export function useActivityReport() {
  return useQuery({
    queryKey: ["report-activity"],
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data } = await fromActivities().select("type, created_by, created_at");
      const activities = (data ?? []) as any[];

      const userMap = new Map<string, { calls: number; emails: number; sms: number; meetings: number }>();
      for (const a of activities) {
        const uid = a.created_by || "unknown";
        if (!userMap.has(uid)) userMap.set(uid, { calls: 0, emails: 0, sms: 0, meetings: 0 });
        const entry = userMap.get(uid)!;
        if (a.type === "call") entry.calls++;
        else if (a.type === "email") entry.emails++;
        else if (a.type === "sms") entry.sms++;
        else if (a.type === "meeting") entry.meetings++;
      }

      return Array.from(userMap.entries()).map(([userId, counts]) => ({
        userId,
        ...counts,
        total: counts.calls + counts.emails + counts.sms + counts.meetings,
      }));
    },
  });
}

// Company Report
export function useCompanyReport() {
  return useQuery({
    queryKey: ["report-company"],
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const [companiesRes, oppsRes, invoicesRes, contactsRes, projectsRes, activitiesRes] = await Promise.all([
        fromCompanies().select("id, name").is("deleted_at", null),
        fromOpps().select("company_id, value, stage"),
        fromInvoices().select("company_id, total, status"),
        fromContacts().select("company_id").is("deleted_at", null),
        fromProjects().select("company_id, status"),
        fromActivities().select("company_id, created_at").order("created_at", { ascending: false }),
      ]);

      const companies = (companiesRes.data ?? []) as any[];
      const opps = (oppsRes.data ?? []) as any[];
      const invoices = (invoicesRes.data ?? []) as any[];
      const contacts = (contactsRes.data ?? []) as any[];
      const projects = (projectsRes.data ?? []) as any[];
      const activities = (activitiesRes.data ?? []) as any[];

      return companies.map((c) => {
        const cOpps = opps.filter((o) => o.company_id === c.id);
        const cInvoices = invoices.filter((i) => i.company_id === c.id);
        const cContacts = contacts.filter((ct) => ct.company_id === c.id);
        const cProjects = projects.filter((p) => p.company_id === c.id && p.status === "active");
        const lastActivity = activities.find((a) => a.company_id === c.id);

        return {
          id: c.id,
          name: c.name,
          pipelineValue: cOpps
            .filter((o) => o.stage !== "closed_won" && o.stage !== "closed_lost")
            .reduce((s, o) => s + (o.value || 0), 0),
          totalInvoiced: cInvoices.reduce((s, i) => s + (i.total || 0), 0),
          totalPaid: cInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0),
          contactCount: cContacts.length,
          activeProjects: cProjects.length,
          lastActivityDate: lastActivity?.created_at || null,
        };
      });
    },
  });
}
