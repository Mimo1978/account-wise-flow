import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Search, ArrowRight, Building2, Calendar, AlertTriangle, Loader2, FileText, Receipt,
} from "lucide-react";
import { format } from "date-fns";

const DARK = {
  border: "hsl(var(--border))",
  text: "hsl(var(--foreground))",
  textSecondary: "hsl(var(--muted-foreground))",
  hover: "hsl(var(--muted))",
};

export default function PlacementsList() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("active");

  /* ── Fetch all placements with joins ── */
  const { data: placements = [], isLoading } = useQuery({
    queryKey: ["placements-list", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await (supabase.from as any)("placements")
        .select("*, candidates(name, current_title, email), companies(name), crm_deals!deal_id(title, stage)")
        .eq("workspace_id", currentWorkspace.id)
        .order("start_date", { ascending: false });
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  /* ── Fetch invoices per placement ── */
  const placementIds = placements.map((p: any) => p.id);
  const { data: invoices = [] } = useQuery({
    queryKey: ["placement-invoices-list", placementIds],
    queryFn: async () => {
      if (placementIds.length === 0) return [];
      const { data } = await (supabase.from as any)("placement_invoices")
        .select("id, placement_id, status, total, currency")
        .in("placement_id", placementIds);
      return data || [];
    },
    enabled: placementIds.length > 0,
  });

  /* ── Fetch SOWs (commercial_documents linked to deals) ── */
  const dealIds = placements.map((p: any) => p.deal_id).filter(Boolean);
  const { data: sows = [] } = useQuery({
    queryKey: ["placement-sows", dealIds],
    queryFn: async () => {
      if (dealIds.length === 0) return [];
      const { data } = await (supabase.from as any)("commercial_documents")
        .select("id, deal_id, status, type, name")
        .in("deal_id", dealIds)
        .in("type", ["sow", "contract"]);
      return data || [];
    },
    enabled: dealIds.length > 0,
  });

  /* ── Helpers ── */
  const getInvoiceSummary = (placementId: string) => {
    const pInvoices = invoices.filter((i: any) => i.placement_id === placementId);
    const outstanding = pInvoices.filter((i: any) => i.status === "sent" || i.status === "draft");
    const paid = pInvoices.filter((i: any) => i.status === "paid");
    const totalOutstanding = outstanding.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    return { total: pInvoices.length, outstanding: outstanding.length, paid: paid.length, totalOutstanding, currency: pInvoices[0]?.currency || "GBP" };
  };

  const getSowStatus = (dealId: string | null) => {
    if (!dealId) return null;
    const doc = sows.find((s: any) => s.deal_id === dealId);
    return doc ? doc.status : null;
  };

  /* ── Filter & search ── */
  const filtered = placements
    .filter((p: any) => statusFilter === "all" || p.status === statusFilter)
    .filter((p: any) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        p.candidates?.name?.toLowerCase().includes(s) ||
        p.companies?.name?.toLowerCase().includes(s) ||
        p.crm_deals?.title?.toLowerCase().includes(s) ||
        p.placement_type?.toLowerCase().includes(s)
      );
    });

  const counts = {
    all: placements.length,
    active: placements.filter((p: any) => p.status === "active").length,
    completed: placements.filter((p: any) => p.status === "completed").length,
    cancelled: placements.filter((p: any) => p.status === "cancelled").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Placements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Active contractors, permanent hires and consulting engagements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search worker, company, deal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64 bg-card border-border"
            />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No placements found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Convert a Won deal to create a placement
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${DARK.border}` }} className="bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Start</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">End</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Charge</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pay</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Margin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">SOW</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoices</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Days left</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const chargeRate = p.charge_rate || p.rate_per_day;
                const payRate = p.buy_rate;
                const margin = chargeRate && payRate && chargeRate > 0
                  ? Math.round((chargeRate - payRate) / chargeRate * 100)
                  : null;
                const daysLeft = p.end_date
                  ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                const isEndingSoon = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
                const isOverdue = daysLeft !== null && daysLeft < 0;
                const inv = getInvoiceSummary(p.id);
                const sowStatus = getSowStatus(p.deal_id);

                return (
                  <tr
                    key={p.id}
                    className="transition-colors cursor-pointer hover:bg-muted/30"
                    style={{ borderBottom: `1px solid ${DARK.border}` }}
                    onClick={() => navigate(`/placements/${p.id}`)}
                  >
                    {/* Worker */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.candidates?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{p.candidates?.current_title || "—"}</p>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <button
                        className="text-sm text-foreground hover:text-primary hover:underline text-left"
                        onClick={(e) => { e.stopPropagation(); if (p.company_id) navigate(`/companies/${p.company_id}`); }}
                      >
                        {p.companies?.name || "—"}
                      </button>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        p.placement_type === "contractor" ? "bg-amber-500/20 text-amber-500" :
                        p.placement_type === "permanent" ? "bg-violet-500/20 text-violet-500" :
                        "bg-blue-500/20 text-blue-500"
                      }`}>{p.placement_type}</span>
                    </td>

                    {/* Start */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.start_date ? format(new Date(p.start_date), "dd MMM yyyy") : "—"}
                    </td>

                    {/* End */}
                    <td className="px-4 py-3 text-xs">
                      {p.end_date ? (
                        <span className={isEndingSoon ? "text-amber-500 font-medium" : isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}>
                          {format(new Date(p.end_date), "dd MMM yyyy")}
                        </span>
                      ) : <span className="text-muted-foreground">Open</span>}
                    </td>

                    {/* Charge */}
                    <td className="px-4 py-3 font-medium text-foreground">
                      {chargeRate ? `${p.currency} ${chargeRate}/d` : "—"}
                    </td>

                    {/* Pay */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {payRate ? `${p.currency} ${payRate}/d` : "—"}
                    </td>

                    {/* Margin */}
                    <td className="px-4 py-3">
                      {margin !== null ? (
                        <span className="text-green-500 font-semibold">{margin}%</span>
                      ) : "—"}
                    </td>

                    {/* SOW */}
                    <td className="px-4 py-3">
                      {sowStatus ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          sowStatus === "signed" ? "bg-green-500/20 text-green-500" :
                          sowStatus === "sent" ? "bg-blue-500/20 text-blue-500" :
                          sowStatus === "draft" ? "bg-muted text-muted-foreground" :
                          "bg-muted text-muted-foreground"
                        }`}>{sowStatus}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Invoices */}
                    <td className="px-4 py-3">
                      {inv.total > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{inv.paid} paid</span>
                          {inv.outstanding > 0 && (
                            <span className="text-xs text-amber-500 font-medium">/ {inv.outstanding} open</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Outstanding */}
                    <td className="px-4 py-3">
                      {inv.totalOutstanding > 0 ? (
                        <span className="text-amber-500 font-semibold text-xs">
                          {inv.currency} {inv.totalOutstanding.toLocaleString()}
                        </span>
                      ) : inv.total > 0 ? (
                        <span className="text-green-500 text-xs">Settled</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Days left */}
                    <td className="px-4 py-3">
                      {daysLeft === null ? <span className="text-muted-foreground text-xs">—</span> :
                       isOverdue ? <span className="text-red-500 font-medium text-xs">Ended</span> :
                       isEndingSoon ? <span className="text-amber-500 font-medium text-xs">{daysLeft}d ⚠</span> :
                       <span className="text-muted-foreground text-xs">{daysLeft}d</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        p.status === "active" ? "bg-green-500/20 text-green-500" :
                        p.status === "completed" ? "bg-muted text-muted-foreground" :
                        "bg-red-500/20 text-red-500"
                      }`}>{p.status}</span>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary bar */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
          <span>{filtered.length} placement{filtered.length !== 1 ? "s" : ""}</span>
          <span>
            {filtered.filter((p: any) => {
              const dl = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000) : null;
              return dl !== null && dl <= 30 && dl > 0;
            }).length} ending soon
          </span>
          <span>
            {(() => {
              const total = filtered.reduce((s: number, p: any) => {
                const inv = getInvoiceSummary(p.id);
                return s + inv.totalOutstanding;
              }, 0);
              return total > 0 ? `£${total.toLocaleString()} outstanding` : "No outstanding invoices";
            })()}
          </span>
        </div>
      )}
    </div>
  );
}
