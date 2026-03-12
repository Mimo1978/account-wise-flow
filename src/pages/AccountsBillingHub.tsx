import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useInvoices, useUpdateInvoice, type Invoice } from '@/hooks/use-invoices';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import {
  Receipt, ArrowUpRight, Loader2, Plus, Download, FileBarChart,
  Search, Building2, Eye, Pencil, Copy, Send, CheckCircle, Trash2, X,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfDay, isBefore, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

const STATUS_CHIPS = ['all', 'draft', 'sent', 'paid', 'overdue', 'void'] as const;
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
  void: 'bg-muted text-muted-foreground line-through',
};

function KPICard({ title, value, subtitle, color, onClick, active }: {
  title: string; value: string; subtitle: string; color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <div className={`absolute inset-y-0 left-0 w-1 ${color}`} />
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 absolute bottom-3 right-3" />
    </Card>
  );
}

const AccountsBillingHub = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { data: invoices = [], isLoading } = useInvoices(currentWorkspace?.id);
  const updateInvoice = useUpdateInvoice();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('filter') || 'all');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const today = startOfDay(new Date());
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);

  // KPI calculations
  const kpis = useMemo(() => {
    let outstanding = 0, outstandingCount = 0;
    let overdue = 0, overdueCount = 0;
    let collected = 0, collectedCount = 0;
    let forecast = 0, forecastCount = 0;

    for (const inv of invoices) {
      if (inv.status === 'void') continue;
      if (inv.status === 'paid') {
        if (inv.paid_date) {
          const pd = startOfDay(new Date(inv.paid_date));
          if (pd >= thisMonthStart && pd <= thisMonthEnd) { collected += inv.amount; collectedCount++; }
        }
        continue;
      }
      if (inv.status === 'draft') continue;
      outstanding += inv.amount; outstandingCount++;
      if (inv.due_date) {
        const d = startOfDay(new Date(inv.due_date));
        if (isBefore(d, today) && !inv.paid_date) { overdue += inv.amount; overdueCount++; }
        if (d >= thisMonthStart && d <= thisMonthEnd) { forecast += inv.amount; forecastCount++; }
      }
    }
    return { outstanding, outstandingCount, overdue, overdueCount, collected, collectedCount, forecast, forecastCount };
  }, [invoices, today, thisMonthStart, thisMonthEnd]);

  // Chart data: last 6 months invoiced vs collected
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(today, i));
      const mEnd = endOfMonth(mStart);
      const label = format(mStart, 'MMM yy');
      let invoiced = 0, col = 0;
      for (const inv of invoices) {
        if (inv.status === 'void') continue;
        if (inv.issued_date) {
          const d = startOfDay(new Date(inv.issued_date));
          if (d >= mStart && d <= mEnd) invoiced += inv.amount;
        }
        if (inv.status === 'paid' && inv.paid_date) {
          const d = startOfDay(new Date(inv.paid_date));
          if (d >= mStart && d <= mEnd) col += inv.amount;
        }
      }
      months.push({ month: label, invoiced, collected: col });
    }
    return months;
  }, [invoices, today]);

  // Client balances
  const clientBalances = useMemo(() => {
    const map = new Map<string, { companyId: string; name: string; openCount: number; total: number; oldest: Date | null; lastPaid: Date | null }>();
    for (const inv of invoices) {
      if (inv.status === 'void' || inv.status === 'draft') continue;
      const cid = inv.company_id;
      const cname = inv.companies?.name ?? 'Unknown';
      const existing = map.get(cid) || { companyId: cid, name: cname, openCount: 0, total: 0, oldest: null, lastPaid: null };
      if (inv.status !== 'paid') {
        existing.openCount++;
        existing.total += inv.amount;
        if (inv.issued_date) {
          const d = new Date(inv.issued_date);
          if (!existing.oldest || d < existing.oldest) existing.oldest = d;
        }
      }
      if (inv.status === 'paid' && inv.paid_date) {
        const d = new Date(inv.paid_date);
        if (!existing.lastPaid || d > existing.lastPaid) existing.lastPaid = d;
      }
      map.set(cid, existing);
    }
    return Array.from(map.values()).filter(c => c.openCount > 0).sort((a, b) => b.total - a.total);
  }, [invoices]);

  // Filtered invoices
  const filtered = useMemo(() => {
    let list = [...invoices];
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'outstanding') list = list.filter(i => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft');
      else if (statusFilter === 'overdue') list = list.filter(i => {
        if (i.status === 'overdue') return true;
        if (i.status === 'paid' || i.status === 'void' || i.status === 'draft') return false;
        return i.due_date && isBefore(startOfDay(new Date(i.due_date)), today) && !i.paid_date;
      });
      else list = list.filter(i => i.status === statusFilter);
    }
    if (companyFilter) list = list.filter(i => i.company_id === companyFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.invoice_number ?? '').toLowerCase().includes(q) ||
        (i.companies?.name ?? '').toLowerCase().includes(q) ||
        (i.engagements?.name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, statusFilter, companyFilter, search, today]);

  const handleAction = async (inv: Invoice, action: string) => {
    try {
      if (action === 'paid') {
        await updateInvoice.mutateAsync({ id: inv.id, status: 'paid', paid_date: new Date().toISOString().split('T')[0] });
        toast.success('Invoice marked as paid');
      } else if (action === 'sent') {
        await updateInvoice.mutateAsync({ id: inv.id, status: 'sent' });
        toast.success('Invoice marked as sent');
      } else if (action === 'void') {
        await updateInvoice.mutateAsync({ id: inv.id, status: 'void' });
        toast.success('Invoice voided');
      }
    } catch { toast.error('Failed to update invoice'); }
  };

  const getStatus = (inv: Invoice) => {
    if (inv.status === 'overdue') return 'overdue';
    if (inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && inv.due_date) {
      if (isBefore(startOfDay(new Date(inv.due_date)), today) && !inv.paid_date) return 'overdue';
    }
    return inv.status;
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Accounts & Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Financial overview across all clients and projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Create Invoice
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Outstanding" value={`£${kpis.outstanding.toLocaleString()}`}
              subtitle={`${kpis.outstandingCount} unpaid`} color="bg-warning"
              active={statusFilter === 'outstanding'}
              onClick={() => { setStatusFilter(statusFilter === 'outstanding' ? 'all' : 'outstanding'); setCompanyFilter(null); }} />
            <KPICard title="Overdue" value={`£${kpis.overdue.toLocaleString()}`}
              subtitle={`${kpis.overdueCount} overdue`} color="bg-destructive"
              active={statusFilter === 'overdue'}
              onClick={() => { setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue'); setCompanyFilter(null); }} />
            <KPICard title="Collected This Month" value={`£${kpis.collected.toLocaleString()}`}
              subtitle={`${kpis.collectedCount} paid`} color="bg-success"
              active={statusFilter === 'paid'}
              onClick={() => { setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid'); setCompanyFilter(null); }} />
            <KPICard title="Forecast This Month" value={`£${kpis.forecast.toLocaleString()}`}
              subtitle={`${kpis.forecastCount} due`} color="bg-primary" />
          </div>

          {/* AR Chart */}
          <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Accounts Receivable — Last 6 Months</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(v: number) => `£${v.toLocaleString()}`} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Bar dataKey="invoiced" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Invoiced" />
                  <Bar dataKey="collected" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Client Balances */}
          {clientBalances.length > 0 && (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Client Balances</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Open Invoices</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Oldest</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Payment</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientBalances.slice(0, 10).map((c) => {
                        const hasOverdue = c.oldest && isBefore(c.oldest, today);
                        const status = hasOverdue ? (c.total > 10000 ? 'At Risk' : 'Overdue') : 'Outstanding';
                        return (
                          <tr key={c.companyId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <button onClick={() => navigate(`/companies/${c.companyId}`)} className="font-medium text-foreground hover:text-primary transition-colors">
                                {c.name}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{c.openCount}</td>
                            <td className="px-4 py-3 font-semibold text-foreground">£{c.total.toLocaleString()}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{c.oldest ? format(c.oldest, 'dd MMM yyyy') : '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{c.lastPaid ? format(c.lastPaid, 'dd MMM yyyy') : '—'}</td>
                            <td className="px-4 py-3">
                              <Badge className={`text-[10px] border-0 ${status === 'At Risk' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 font-bold' : status === 'Overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}`}>
                                {status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCompanyFilter(c.companyId); setStatusFilter('all'); }}>
                                View invoices
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoice List */}
          <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {STATUS_CHIPS.map((s) => (
                    <button key={s} onClick={() => { setStatusFilter(s); setCompanyFilter(null); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      {s}
                    </button>
                  ))}
                  {companyFilter && (
                    <button onClick={() => setCompanyFilter(null)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Company filtered <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Project</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No invoices match your filters</td></tr>
                    ) : filtered.map((inv) => {
                      const status = getStatus(inv);
                      return (
                        <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                          <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.companies?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.engagements?.name ?? '—'}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{inv.currency} {inv.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] border-0 capitalize ${STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'}`}>{status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{inv.issued_date ? format(new Date(inv.issued_date), 'dd MMM yyyy') : '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {inv.due_date ? (
                              <span className={status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                {format(new Date(inv.due_date), 'dd MMM yyyy')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedInvoice(inv)}><Eye className="w-3.5 h-3.5" /></Button>
                              {status !== 'paid' && status !== 'void' && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction(inv, 'paid')}><CheckCircle className="w-3.5 h-3.5 text-green-600" /></Button>
                              )}
                              {status === 'draft' && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction(inv, 'sent')}><Send className="w-3.5 h-3.5" /></Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Invoice Detail Slide-in */}
      <Sheet open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedInvoice && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Invoice {selectedInvoice.invoice_number || '#' + selectedInvoice.id.slice(0, 6)}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Status & Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_STYLES[getStatus(selectedInvoice)] ?? 'bg-muted'} border-0 capitalize`}>
                    {getStatus(selectedInvoice)}
                  </Badge>
                  <div className="flex-1" />
                  {getStatus(selectedInvoice) !== 'paid' && getStatus(selectedInvoice) !== 'void' && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { handleAction(selectedInvoice, 'sent'); }}>
                        <Send className="w-3.5 h-3.5" /> Send
                      </Button>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => { handleAction(selectedInvoice, 'paid'); setSelectedInvoice(null); }}>
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive" onClick={() => { handleAction(selectedInvoice, 'void'); setSelectedInvoice(null); }}>
                    <Trash2 className="w-3.5 h-3.5" /> Void
                  </Button>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium text-foreground">{selectedInvoice.companies?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Project</p>
                    <p className="font-medium text-foreground">{selectedInvoice.engagements?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-xl font-bold text-foreground">{selectedInvoice.currency} {selectedInvoice.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <p className="font-medium text-foreground">{selectedInvoice.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Issued Date</p>
                    <p className="font-medium text-foreground">{selectedInvoice.issued_date ? format(new Date(selectedInvoice.issued_date), 'dd MMM yyyy') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className={`font-medium ${getStatus(selectedInvoice) === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>
                      {selectedInvoice.due_date ? format(new Date(selectedInvoice.due_date), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                  {selectedInvoice.paid_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paid Date</p>
                      <p className="font-medium text-green-600">{format(new Date(selectedInvoice.paid_date), 'dd MMM yyyy')}</p>
                    </div>
                  )}
                </div>

                {selectedInvoice.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </div>
                )}

                {/* Quick links */}
                <div className="flex items-center gap-2 pt-4 border-t border-border">
                  {selectedInvoice.engagement_id && (
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { setSelectedInvoice(null); navigate(`/projects/${selectedInvoice.engagement_id}`); }}>
                      View Project
                    </Button>
                  )}
                  {selectedInvoice.company_id && (
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { setSelectedInvoice(null); navigate(`/companies/${selectedInvoice.company_id}`); }}>
                      <Building2 className="w-3.5 h-3.5" /> View Company
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CreateInvoiceModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default AccountsBillingHub;
