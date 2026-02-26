import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmInvoices, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, getDisplayStatus } from "@/hooks/use-crm-invoices";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { CreateCrmInvoicePanel } from "@/components/crm/CreateCrmInvoicePanel";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export default function CrmInvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: invoices = [], isLoading } = useCrmInvoices({
    search: search || undefined,
    company_id: companyFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: companies = [] } = useCrmCompanies();

  const currencySymbol = (c: string) => c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  // Summary cards - this month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const summaryInvoiced = useMemo(() =>
    invoices.filter(i => i.issue_date && isWithinInterval(new Date(i.issue_date), { start: monthStart, end: monthEnd }))
      .reduce((s, i) => s + i.total, 0),
    [invoices]
  );
  const summaryPaid = useMemo(() =>
    invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    [invoices]
  );
  const summaryOverdue = useMemo(() =>
    invoices.filter(i => getDisplayStatus(i) === "overdue").reduce((s, i) => s + i.total, 0),
    [invoices]
  );
  const summaryOutstanding = useMemo(() =>
    invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.total, 0),
    [invoices]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        </div>
        <Button onClick={() => setPanelOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground uppercase">Invoiced (This Month)</p>
          <p className="text-2xl font-bold">£{summaryInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground uppercase">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">£{summaryPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground uppercase">Total Overdue</p>
          <p className="text-2xl font-bold text-red-600">£{summaryOverdue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground uppercase">Outstanding</p>
          <p className="text-2xl font-bold text-blue-600">£{summaryOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
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

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
            ) : invoices.map(inv => {
              const displayStatus = getDisplayStatus(inv);
              return (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/invoices/${inv.id}`)}>
                  <TableCell className="font-medium text-primary">{inv.invoice_number || "—"}</TableCell>
                  <TableCell>
                    {inv.crm_companies ? (
                      <span className="text-primary cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); navigate(`/crm/companies/${inv.crm_companies!.id}`); }}>
                        {inv.crm_companies.name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {inv.crm_deals ? (
                      <span className="text-primary cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); navigate(`/crm/deals/${inv.crm_deals!.id}`); }}>
                        {inv.crm_deals.title}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{inv.issue_date ? format(new Date(inv.issue_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="font-semibold">{currencySymbol(inv.currency)}{inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={INVOICE_STATUS_COLORS[displayStatus]}>
                      {INVOICE_STATUS_LABELS[displayStatus]}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CreateCrmInvoicePanel open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
