import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DeletableRecordType } from "@/hooks/use-deletion";

export interface Dependency {
  type: string;
  count: number;
  label: string;
  blocking: boolean;
  value?: number;
  currency?: string;
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
  value: string
): Promise<number> {
  const { count, error } = await (supabase
    .from(table as any)
    .select("id", { count: "exact", head: true }) as any)
    .eq(column, value);

  if (error) {
    console.error(`[DependencyCheck] Error counting ${table}.${column}:`, error);
    return 0;
  }
  return count ?? 0;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
}

async function checkCompanyDeps(recordId: string): Promise<Dependency[]> {
  // Check if this is a crm_companies record or companies record
  const { data: crmDirect } = await (supabase
    .from("crm_companies" as any)
    .select("id") as any)
    .eq("id", recordId)
    .maybeSingle();

  let crmId: string | null = (crmDirect as any)?.id || null;

  if (!crmId) {
    const { data: company } = await (supabase
      .from("companies" as any)
      .select("name") as any)
      .eq("id", recordId)
      .maybeSingle();
    const companyName = (company as any)?.name;
    if (companyName) {
      const { data: crmByName } = await (supabase
        .from("crm_companies" as any)
        .select("id") as any)
        .eq("name", companyName)
        .limit(1)
        .maybeSingle();
      crmId = (crmByName as any)?.id || null;
    }
  }

  const deps: Dependency[] = [];

  // Contacts
  const contactsCount = await countRows("contacts", "company_id", recordId);
  const crmContactsCount = crmId ? await countRows("crm_contacts", "company_id", crmId) : 0;
  const totalContacts = contactsCount + crmContactsCount;
  if (totalContacts > 0) {
    deps.push({
      type: "contacts",
      count: totalContacts,
      label: `${totalContacts} contact${totalContacts !== 1 ? "s" : ""}`,
      blocking: false,
      viewPath: `/companies`,
    });
  }

  // Deals
  if (crmId) {
    const { data: dealData } = await (supabase
      .from("crm_deals" as any)
      .select("id, value, currency, stage") as any)
      .eq("company_id", crmId)
      .is("deleted_at", null);

    const allDeals = (dealData || []) as any[];
    const blockingDeals = allDeals.filter(
      (d) => !["won", "lost"].includes(d.stage?.toLowerCase())
    );
    const nonBlockingDeals = allDeals.filter(
      (d) => ["won", "lost"].includes(d.stage?.toLowerCase())
    );

    if (blockingDeals.length > 0) {
      const totalValue = blockingDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
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

    // Invoices
    const { data: invoiceData } = await (supabase
      .from("crm_invoices" as any)
      .select("id, total, currency, status") as any)
      .eq("company_id", crmId)
      .is("deleted_at", null);

    const allInvoices = (invoiceData || []) as any[];
    const blockingInvoices = allInvoices.filter(
      (i) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
    );
    const nonBlockingInvoices = allInvoices.filter(
      (i) => ["paid", "void", "cancelled"].includes(i.status?.toLowerCase())
    );

    if (blockingInvoices.length > 0) {
      const totalValue = blockingInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
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
    if (docsCount > 0) {
      deps.push({
        type: "documents",
        count: docsCount,
        label: `${docsCount} document${docsCount !== 1 ? "s" : ""}`,
        blocking: false,
      });
    }
  }

  // Projects/engagements
  const engCount = await countRows("engagements", "company_id", recordId);
  if (engCount > 0) {
    deps.push({
      type: "projects",
      count: engCount,
      label: `${engCount} project${engCount !== 1 ? "s" : ""}`,
      blocking: false,
      viewPath: `/projects`,
    });
  }

  return deps;
}

async function checkContactDeps(recordId: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  const { data: dealData } = await (supabase
    .from("crm_deals" as any)
    .select("id, value, currency, stage") as any)
    .eq("contact_id", recordId)
    .is("deleted_at", null);

  const allDeals = (dealData || []) as any[];
  const activeDeals = allDeals.filter(
    (d) => !["won", "lost"].includes(d.stage?.toLowerCase())
  );
  if (activeDeals.length > 0) {
    const totalValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
    deps.push({
      type: "deals",
      count: activeDeals.length,
      label: `${activeDeals.length} active deal${activeDeals.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, activeDeals[0]?.currency || "GBP")})`,
      blocking: true,
      value: totalValue,
      viewPath: `/crm/deals`,
    });
  }

  const closedDeals = allDeals.filter(
    (d) => ["won", "lost"].includes(d.stage?.toLowerCase())
  );
  if (closedDeals.length > 0) {
    deps.push({
      type: "closed_deals",
      count: closedDeals.length,
      label: `${closedDeals.length} closed deal${closedDeals.length !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

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

  const { data: invoiceData } = await (supabase
    .from("crm_invoices" as any)
    .select("id, total, currency, status") as any)
    .eq("deal_id", recordId)
    .is("deleted_at", null);

  const allInvoices = (invoiceData || []) as any[];
  const blockingInvoices = allInvoices.filter(
    (i) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
  );
  const paidInvoices = allInvoices.filter(
    (i) => ["paid", "void", "cancelled"].includes(i.status?.toLowerCase())
  );

  if (blockingInvoices.length > 0) {
    const totalValue = blockingInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
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

  const { data: invoiceData } = await (supabase
    .from("invoices" as any)
    .select("id, total, currency, status") as any)
    .eq("engagement_id", recordId);

  const allInvoices = (invoiceData || []) as any[];
  const blockingInvoices = allInvoices.filter(
    (i) => ["sent", "overdue", "draft"].includes(i.status?.toLowerCase())
  );
  if (blockingInvoices.length > 0) {
    const totalValue = blockingInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    deps.push({
      type: "invoices",
      count: blockingInvoices.length,
      label: `${blockingInvoices.length} unpaid invoice${blockingInvoices.length !== 1 ? "s" : ""} (${formatCurrency(totalValue, blockingInvoices[0]?.currency || "GBP")})`,
      blocking: true,
      value: totalValue,
      viewPath: `/crm/invoices`,
    });
  }

  const sowsCount = await countRows("sows", "engagement_id", recordId);
  if (sowsCount > 0) {
    deps.push({
      type: "sows",
      count: sowsCount,
      label: `${sowsCount} statement${sowsCount !== 1 ? "s" : ""} of work`,
      blocking: false,
    });
  }

  const jobsCount = await countRows("jobs", "engagement_id", recordId);
  if (jobsCount > 0) {
    deps.push({
      type: "jobs",
      count: jobsCount,
      label: `${jobsCount} job${jobsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

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

  const dealsCount = await countRows("crm_deals", "project_id", recordId);
  if (dealsCount > 0) {
    deps.push({
      type: "deals",
      count: dealsCount,
      label: `${dealsCount} deal${dealsCount !== 1 ? "s" : ""}`,
      blocking: false,
    });
  }

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
