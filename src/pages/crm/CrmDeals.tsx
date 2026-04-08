import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowUpDown, Pencil, LayoutGrid, List, DollarSign, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmDeals, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS, type CrmDealWithRelations } from "@/hooks/use-crm-deals";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { AddEditDealPanel } from "@/components/crm/AddEditDealPanel";
import { DealIntegrityBadges } from "@/components/deals/DealIntegrityBadges";
import { PipelineChevron as SharedPipelineChevron } from "@/components/pipeline/PipelineChevron";
import { format, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/ui/SectionCard";
import type { CrmDeal } from "@/types/crm";

type SortKey = "title" | "value" | "status" | "signed_date" | "start_date";
type ViewMode = "cards" | "table";

const STAGE_BADGE: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  qualified: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  negotiation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};


export default function CrmDealsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStage = searchParams.get("stage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(initialStage);
  const [sortKey, setSortKey] = useState<SortKey>("signed_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<CrmDeal | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("deals_view_mode") as ViewMode) || "cards";
  });

  useEffect(() => {
    localStorage.setItem("deals_view_mode", viewMode);
  }, [viewMode]);

  const { data: deals = [], isLoading } = useCrmDeals({
    search: search || undefined,
    company_id: companyFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: companies = [] } = useCrmCompanies();

  const currencySymbol = (c: string) => c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  // Apply stage filter on top of hook filters
  const stageFiltered = useMemo(() => {
    if (!stageFilter) return deals;
    return deals.filter(d => (d as any).stage === stageFilter);
  }, [deals, stageFilter]);

  const sorted = useMemo(() => {
    const arr = [...stageFiltered];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      if (sortKey === "value") return sortAsc ? a.value - b.value : b.value - a.value;
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [stageFiltered, sortKey, sortAsc]);

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  const handleStageFilter = (stage: string | null) => {
    setStageFilter(stage);
    if (stage) {
      setSearchParams({ stage });
    } else {
      setSearchParams({});
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
    </TableHead>
  );

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F8FAFC' }}>Deals</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Pipeline overview · {deals.length} deal{deals.length !== 1 ? "s" : ""} · £{totalValue.toLocaleString()} across all stages
            </p>
          </div>
        </div>

        {/* Pipeline section card */}
        <SectionCard
          accentColor="#378ADD"
          title="Deal Pipeline"
          icon={<TrendingUp className="w-4 h-4" />}
          headerRight={
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {deals.length} deals · £{totalValue.toLocaleString()}
              </span>
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => { setEditDeal(null); setPanelOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> + New Deal
              </Button>
            </div>
          }
        >
          {/* Pipeline chevrons */}
          <div data-jarvis-section="pipeline-snapshot" style={{ margin: 0, padding: 0, width: '100%', overflow: 'hidden' }}>
            <SharedPipelineChevron
              mode="filter"
              deals={deals}
              selectedStage={stageFilter}
              onStageClick={(stage) => handleStageFilter(stage)}
              showCounts={true}
              showValues={true}
            />
          </div>

          {/* Filters + view toggle */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search deals…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="_all">All Statuses</SelectItem>
                {Object.entries(DEAL_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={v => setCompanyFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="_all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {stageFilter && (
              <Button variant="ghost" size="sm" onClick={() => handleStageFilter(null)} className="text-muted-foreground">Clear stage filter</Button>
            )}
            <div className="ml-auto flex items-center border rounded-md overflow-hidden" style={{ borderColor: 'hsl(var(--border))' }}>
              <button
                onClick={() => setViewMode("cards")}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1 transition-colors", viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                style={viewMode !== "cards" ? { background: 'hsl(var(--muted))' } : {}}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn("px-3 py-1.5 text-xs flex items-center gap-1 transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                style={viewMode !== "table" ? { background: 'hsl(var(--muted))' } : {}}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <p className="text-center py-12 text-muted-foreground">Loading deals…</p>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{search || stageFilter || statusFilter || companyFilter ? "No deals match your filters." : "No deals yet. Create your first deal."}</p>
            </div>
          ) : viewMode === "cards" ? (
            /* ═══ CARD VIEW ═══ */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {sorted.map(d => {
                const stage = (d as any).stage || "lead";
                const daysOpen = d.created_at ? differenceInDays(new Date(), parseISO(d.created_at)) : 0;
                return (
                  <div key={d.id} className="rounded-lg p-4 transition-all hover:brightness-110 cursor-pointer"
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
                    onClick={() => navigate(`/crm/deals/${d.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: '#F8FAFC' }}>{d.title}</p>
                      <Badge className={cn("text-xs capitalize shrink-0", STAGE_BADGE[stage] || "bg-muted")}>{stage}</Badge>
                      {(d as any).deal_type && (
                        <span className={cn("ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          (d as any).deal_type === 'contractor' && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                          (d as any).deal_type === 'permanent' && "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
                          (d as any).deal_type === 'consulting' && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                        )}>
                          {(d as any).deal_type === 'contractor' ? 'Contr.' : (d as any).deal_type === 'permanent' ? 'Perm' : 'Consult.'}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-bold mt-1" style={{ color: '#F8FAFC' }}>{currencySymbol(d.currency)}{(d.value || 0).toLocaleString()}</p>
                    <DealIntegrityBadges contactId={(d as any).contact_id} projectId={(d as any).project_id} />
                    <div className="flex items-center justify-between text-xs mt-2 text-muted-foreground">
                      <span>{d.crm_companies?.name || "No company"}</span>
                      <span>{daysOpen}d open</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ═══ TABLE VIEW ═══ */
            <div className="rounded-lg overflow-auto mt-4" style={{ border: '1px solid hsl(var(--border))' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Deal" k="title" />
                    <TableHead>Company</TableHead>
                    <TableHead>Stage</TableHead>
                    <SortHeader label="Value" k="value" />
                    <TableHead>Contact</TableHead>
                    <TableHead>Days Open</TableHead>
                    <SortHeader label="Status" k="status" />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((d, index) => {
                    const stage = (d as any).stage || "lead";
                    const daysOpen = d.created_at ? differenceInDays(new Date(), parseISO(d.created_at)) : 0;
                    return (
                      <TableRow key={d.id} className="cursor-pointer"
                        style={{
                          background: 'transparent',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => navigate(`/crm/deals/${d.id}`)}>
                        <TableCell className="font-medium text-primary">{d.title}</TableCell>
                        <TableCell>
                          {d.crm_companies ? (
                            <span className="text-primary cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); navigate(`/companies/${d.crm_companies!.id}`); }}>
                              {d.crm_companies.name}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge className={cn("text-xs capitalize", STAGE_BADGE[stage] || "bg-muted")}>{stage}</Badge></TableCell>
                        <TableCell className="font-semibold">{currencySymbol(d.currency)}{d.value.toLocaleString()}</TableCell>
                        <TableCell>{(d as any).crm_contacts ? `${(d as any).crm_contacts.first_name} ${(d as any).crm_contacts.last_name}` : "—"}</TableCell>
                        <TableCell>{daysOpen}d</TableCell>
                        <TableCell><Badge variant="secondary" className={DEAL_STATUS_COLORS[d.status]}>{DEAL_STATUS_LABELS[d.status] || d.status}</Badge></TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => { setEditDeal(d); setPanelOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <AddEditDealPanel open={panelOpen} onOpenChange={setPanelOpen} deal={editDeal} />
      </div>
    </div>
  );
}
