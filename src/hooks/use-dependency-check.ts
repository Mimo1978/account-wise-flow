import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DeletableRecordType } from "@/hooks/use-deletion";

export interface Dependency {
  type: string;
  count: number;
  label: string;
  blocking: boolean;
  /** For blocking items, show aggregate value if available */
  value?: number;
  currency?: string;
  /** Link to view these records */
  viewPath?: string;
}

export interface DependencyCheckResult {
  isLoading: boolean;
  hasBlocking: boolean;
  hasAny: boolean;
  dependencies: Dependency[];
}

async function countRows(
  table: string,
  column: string,
  value: string,
  extraFilters?: Record<string, any>
): Promise<number> {
  let q = supabase
    .from(table as any)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (extraFilters) {
    for (const [k, v] of Object.entries(extraFilters)) {
      if (v === null) {
        q = q.is(k, null);
      } else if (Array.isArray(v)) {
        q = q.in(k, v);
      } else {
        q = q.eq(k, v);
      }
    }
  }

  const { count, error } = await q;
  if (error) {
    console.error(`[DependencyCheck] Error counting ${table}.${column}:`, error);
    return 0;
  }
  return count ?? 0;
}

async function sumColumn(
  table: string,
  filterColumn: string,
  filterValue: string,
  sumCol: string,
  extraFilters?: Record<string, any>
): Promise<{ total: number; currency: string }> {
  let q = supabase
    .from(table as any)
    .select(`${sumCol}, currency`)
    .eq(filterColumn, filterValue);

  if (extraFilters) {
    for (const [k, v] of Object.entries(extraFilters)) {
      if (v === null) q = q.is(k, null);
      else if (Array.isArray(v)) q = q.in(k, v);
      else q = q.eq(k, v);
    }
  }

  const { data, error } = await q;
  if (error || !data) return { total: 0, currency: "GBP" };

  const total = (data as any[]).reduce((sum, r) => sum + (Number(r[sumCol]) || 0), 0);
  const currency = (data as any[])[0]?.currency || "GBP";
  return { total, currency };
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
}

async function checkCompanyDeps(recordId: string): Promise<Dependency[]> {
  // Check both companies and crm_companies tables by looking up CRM company ID
  const { data: crmMatch } = await supabase
    .from("crm_companies" as any)
    .select("id")
    .eq("id", recordId)
    .maybeSingle();

  // Also check if there's a crm_companies record linked by name
  let crmId = crmMatch?.id || null;
  if (!crmId) {
    const { data: company } = await supabase
      .from("companies" as any)
      .select("name")
      .eq("id", recordId)
      .maybeSingle();
    if (company?.name) {
      const { data: crmByName } = await supabase
        .from("crm_companies" as any)
        .select("id")
        .eq("name", company.name)
        .limit(1)
        .maybeSingle();
      crmId = crmByName?.id || null;
    }
  }

  const deps: Dependency[] = [];

  // Contacts from native table
  const contactsCount = await countRows("contacts", "company_id", recordId);
  // Contacts from CRM table
  const crmContactsCount = crmId ? await countRows("crm_contacts", "company_id", crmId) : 0;
  const totalContacts = contactsCount + crmContactsCount;
  deps.push({
    type: "contacts",
    count: totalContacts,
    label: `${totalContacts} contact${totalContacts !== 1 ? "s" : ""}`,
    blocking: false,
    viewPath: `/companies`,
  });

  // Active deals (blocking)
  if (crmId) {
    const activeDeals = await countRows("crm_deals", "company_id", crmId, {
      deleted_at: null,
    });
    // Filter to only active (not won/lost)
    const { data: activeDealData } = await supabase
      .from("crm_deals" as any)
      .select("id, value, currency, stage")
      .eq("company_id", crmId)
      .is("deleted_at", null);
    
    const blockingDeals = (activeDealData || []).filter(
      (d: any) => !["won", "lost"].includes(d.stage?.toLowerCase())
    );
    const nonBlockingDeals = (activeDealData || []).filter(
      (d: any) => ["won", "lost"].includes(d.stage?.toLowerCase())
    );

    if (blockingDeals.length > 0) {
      const totalValue = blockingDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
      const currency = blockingDeals[0]?.currency || "GBP";
      deps.push({
        type: "deals",
        count: blockingDeals.length,
        label: `${blockingDeals.length} active deal${blockingDeals.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, currency)})`,
        blocking: true,
        value: totalValue,
        currency,
        viewPath: `/crm/deals`,
      });
    }
    if (nonBlockingDeals.length > 0) {
      deps.push({
        type: "closed_deals",
        count: nonBlockingDeals.length,
        label: `${nonBlockingDeals.length} closed deal${nonBlockingDeals.length !== 1 ? "s" : ""}`,
        blocking: false,
      });
    }

    // Invoices (blocking if unpaid)
    const { data: invoiceData } = await supabase
      .from("crm_invoices" as any)
      .select("id, total, currency, status")
      .eq("company_id", crmId)
      .is("deleted_at", null);

    const blockingInvoices = (invoiceData || []).filter(
      (i: any) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
    );
    const nonBlockingInvoices = (invoiceData || []).filter(
      (i: any) => ["paid", "void", "cancelled"].includes(i.status?.toLowerCase())
    );

    if (blockingInvoices.length > 0) {
      const totalValue = blockingInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
      const currency = blockingInvoices[0]?.currency || "GBP";
      deps.push({
        type: "invoices",
        count: blockingInvoices.length,
        label: `${blockingInvoices.length} unpaid invoice${blockingInvoices.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, currency)})`,
        blocking: true,
        value: totalValue,
        currency,
        viewPath: `/crm/invoices`,
      });
    }
    if (nonBlockingInvoices.length > 0) {
      deps.push({
        type: "paid_invoices",
        count: nonBlockingInvoices.length,
        label: `${nonBlockingInvoices.length} paid/void invoice${nonBlockingInvoices.length !== 1 ? "s" : ""}`,
        blocking: false,
      });
    }

    // Documents
    const docsCount = await countRows("crm_documents", "company_id", crmId);
    deps.push({
      type: "documents",
      count: docsCount,
      label: `${docsCount} document${docsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  // Projects/engagements
  const engCount = await countRows("engagements", "company_id", recordId);
  deps.push({
    type: "projects",
    count: engCount,
    label: `${engCount} project${engCount !== 1 ? "s" : ""}`,
    blocking: false,
    viewPath: `/projects`,
  });

  return deps.filter((d) => d.count > 0);
}

async function checkContactDeps(recordId: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Deals linked to this contact
  const { data: dealData } = await supabase
    .from("crm_deals" as any)
    .select("id, value, currency, stage")
    .eq("contact_id", recordId)
    .is("deleted_at", null);

  const activeDeals = (dealData || []).filter(
    (d: any) => !["won", "lost"].includes(d.stage?.toLowerCase())
  );
  if (activeDeals.length > 0) {
    const totalValue = activeDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    deps.push({
      type: "deals",
      count: activeDeals.length,
      label: `${activeDeals.length} active deal${activeDeals.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, activeDeals[0]?.currency || "GBP")})`,
      blocking: true,
      value: totalValue,
      viewPath: `/crm/deals`,
    });
  }

  const closedDeals = (dealData || []).filter(
    (d: any) => ["won", "lost"].includes(d.stage?.toLowerCase())
  );
  if (closedDeals.length > 0) {
    deps.push({
      type: "closed_deals",
      count: closedDeals.length,
      label: `${closedDeals.length} closed deal${closedDeals.length !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  // Outreach targets
  const targetsCount = await countRows("outreach_targets", "contact_id", recordId);
  if (targetsCount > 0) {
    deps.push({
      type: "outreach",
      count: targetsCount,
      label: `${targetsCount} outreach target${targetsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  return deps;
}

async function checkDealDeps(recordId: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Invoices
  const { data: invoiceData } = await supabase
    .from("crm_invoices" as any)
    .select("id, total, currency, status")
    .eq("deal_id", recordId)
    .is("deleted_at", null);

  const blockingInvoices = (invoiceData || []).filter(
    (i: any) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
  );
  const paidInvoices = (invoiceData || []).filter(
    (i: any) => ["paid", "void", "cancelled"].includes(i.status?.toLowerCase())
  );

  if (blockingInvoices.length > 0) {
    const totalValue = blockingInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
    deps.push({
      type: "invoices",
      count: blockingInvoices.length,
      label: `${blockingInvoices.length} unpaid invoice${blockingInvoices.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, blockingInvoices[0]?.currency || "GBP")})`,
      blocking: true,
      value: totalValue,
      viewPath: `/crm/invoices`,
    });
  }
  if (paidInvoices.length > 0) {
    deps.push({
      type: "paid_invoices",
      count: paidInvoices.length,
      label: `${paidInvoices.length} paid/void invoice${paidInvoices.length !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  // Documents
  const docsCount = await countRows("crm_documents", "deal_id", recordId);
  if (docsCount > 0) {
    deps.push({
      type: "documents",
      count: docsCount,
      label: `${docsCount} document${docsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  return deps;
}

async function checkProjectDeps(recordId: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Invoices
  const { data: invoiceData } = await supabase
    .from("invoices" as any)
    .select("id, total, currency, status")
    .eq("engagement_id", recordId);

  const blockingInvoices = (invoiceData || []).filter(
    (i: any) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
  );
  if (blockingInvoices.length > 0) {
    const totalValue = blockingInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
    deps.push({
      type: "invoices",
      count: blockingInvoices.length,
      label: `${blockingInvoices.length} unpaid invoice${blockingInvoices.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, blockingInvoices[0]?.currency || "GBP")})`,
      blocking: true,
      value: totalValue,
      viewPath: `/crm/invoices`,
    });
  }

  // SOWs
  const sowsCount = await countRows("sows", "engagement_id", recordId);
  if (sowsCount > 0) {
    deps.push({
      type: "sows",
      count: sowsCount,
      label: `${sowsCount} statement${sowsCount !== 1 ? "s" : ""} of work`,
      blocking: false,
    });
  }

  // Jobs
  const jobsCount = await countRows("jobs", "engagement_id", recordId);
  if (jobsCount > 0) {
    deps.push({
      type: "jobs",
      count: jobsCount,
      label: `${jobsCount} job${jobsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  // Outreach campaigns
  const campaignsCount = await countRows("outreach_campaigns", "engagement_id", recordId);
  if (campaignsCount > 0) {
    deps.push({
      type: "campaigns",
      count: campaignsCount,
      label: `${campaignsCount} outreach campaign${campaignsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  return deps;
}

async function checkCrmProjectDeps(recordId: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  // Deals linked to this project
  const dealsCount = await countRows("crm_deals", "project_id", recordId);
  if (dealsCount > 0) {
    deps.push({
      type: "deals",
      count: dealsCount,
      label: `${dealsCount} deal${dealsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

  // Opportunities
  const oppsCount = await countRows("crm_opportunities", "project_id", recordId);
  if (oppsCount > 0) {
    deps.push({
      type: "opportunities",
      count: oppsCount,
      label: `${oppsCount} opportunit${oppsCount !== 1 ? "ies" : "y"}`,
      blocking: false,
    });
  }

  return deps;
}

export function useDependencyCheck(
  recordType: DeletableRecordType | string,
  recordId: string,
  enabled: boolean = true
): DependencyCheckResult {
  const { data, isLoading } = useQuery({
    queryKey: ["dependency-check", recordType, recordId],
    queryFn: async (): Promise<Dependency[]> => {
      switch (recordType) {
        case "companies":
        case "crm_companies":
          return checkCompanyDeps(recordId);
        case "contacts":
        case "crm_contacts":
          return checkContactDeps(recordId);
        case "crm_deals":
          return checkDealDeps(recordId);
        case "engagements":
          return checkProjectDeps(recordId);
        case "crm_projects":
          return checkCrmProjectDeps(recordId);
        default:
          return [];
      }
    },
    enabled: enabled && !!recordId,
    staleTime: 30_000,
  });

  const dependencies = data ?? [];
  return {
    isLoading,
    hasBlocking: dependencies.some((d) => d.blocking),
    hasAny: dependencies.length > 0,
    dependencies,
  };
}
