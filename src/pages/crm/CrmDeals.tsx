import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpDown, Handshake, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmDeals, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/hooks/use-crm-deals";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { AddEditDealPanel } from "@/components/crm/AddEditDealPanel";
import { format } from "date-fns";
import type { CrmDeal } from "@/types/crm";

type SortKey = "title" | "value" | "status" | "signed_date" | "start_date";

export default function CrmDealsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("signed_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<CrmDeal | null>(null);

  const { data: deals = [], isLoading } = useCrmDeals({
    search: search || undefined,
    company_id: companyFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: companies = [] } = useCrmCompanies();

  const currencySymbol = (c: string) => c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  const sorted = useMemo(() => {
    const arr = [...deals];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      if (sortKey === "value") return sortAsc ? a.value - b.value : b.value - a.value;
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [deals, sortKey, sortAsc]);

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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
        </div>
        <Button onClick={() => { setEditDeal(null); setPanelOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Deal
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Deal Title" k="title" />
              <TableHead>Company</TableHead>
              <SortHeader label="Value" k="value" />
              <TableHead>Currency</TableHead>
              <SortHeader label="Status" k="status" />
              <SortHeader label="Signed" k="signed_date" />
              <SortHeader label="Start" k="start_date" />
              <TableHead>End</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No deals found</TableCell></TableRow>
            ) : sorted.map(d => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/deals/${d.id}`)}>
                <TableCell className="font-medium text-primary">{d.title}</TableCell>
                <TableCell>
                  {d.crm_companies ? (
                    <span className="text-primary cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); navigate(`/companies/${d.crm_companies!.id}`); }}>
                      {d.crm_companies.name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="font-semibold">{currencySymbol(d.currency)}{d.value.toLocaleString()}</TableCell>
                <TableCell>{d.currency}</TableCell>
                <TableCell><Badge variant="secondary" className={DEAL_STATUS_COLORS[d.status]}>{DEAL_STATUS_LABELS[d.status]}</Badge></TableCell>
                <TableCell>{d.signed_date ? format(new Date(d.signed_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{d.start_date ? format(new Date(d.start_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{d.end_date ? format(new Date(d.end_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{d.payment_terms || "—"}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => { setEditDeal(d); setPanelOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddEditDealPanel open={panelOpen} onOpenChange={setPanelOpen} deal={editDeal} />
    </div>
  );
}
