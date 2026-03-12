import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useInvoices, useUpdateInvoice, useCreateInvoice, type Invoice } from '@/hooks/use-invoices';
import { useInvoiceLineItems, useCreateInvoiceLineItem, useDeleteInvoiceLineItem, type InvoiceLineItem } from '@/hooks/use-invoice-line-items';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import {
  Receipt, ArrowUpRight, Loader2, Plus, Download, FileBarChart,
  Search, Building2, Eye, Pencil, Copy, Send, CheckCircle, Trash2, X,
  AlertTriangle, Ban,
} from 'lucide-react';
import { format, startOfDay, isBefore, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
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

const VAT_OPTIONS = [
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '20%', value: 20 },
];

function KPICard({ title, value, subtitle, color, onClick, active }: {
  title: string; value: string; subtitle: string; color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)] group ${active ? 'ring-2 ring-primary' : ''}`} onClick={onClick}>
      <div className={`absolute inset-y-0 left-0 w-1 ${color}`} />
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
      <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3" />
    </Card>
  );
}

/* ─── Invoice Detail Panel ─── */
function InvoiceDetailPanel({
  invoice: inv,
  onClose,
  onAction,
  onDuplicate,
  workspaceId,
}: {
  invoice: Invoice;
  onClose: () => void;
  onAction: (inv: Invoice, action: string) => Promise<void>;
  onDuplicate: (inv: Invoice) => void;
  workspaceId: string | undefined;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    invoice_number: inv.invoice_number || '',
    issued_date: inv.issued_date || '',
    due_date: inv.due_date || '',
    notes: inv.notes || '',
    status: inv.status,
    amount: inv.amount,
    currency: inv.currency,
  });

  const { data: lineItems = [] } = useInvoiceLineItems(inv.id);
  const createLineItem = useCreateInvoiceLineItem();
  const deleteLineItem = useDeleteInvoiceLineItem();
  const updateInvoice = useUpdateInvoice();

  // Local line item state for editing
  const [editLines, setEditLines] = useState<{ description: string; quantity: number; unit_price: number }[]>([]);
  const [vatRate, setVatRate] = useState(0);

  useEffect(() => {
    if (editing && lineItems.length > 0) {
      setEditLines(lineItems.map(li => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price })));
    } else if (editing && lineItems.length === 0) {
      setEditLines([{ description: '', quantity: 1, unit_price: 0 }]);
    }
  }, [editing, lineItems]);

  const subtotal = lineItems.length > 0
    ? lineItems.reduce((s, li) => s + li.line_total, 0)
    : inv.amount;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const editSubtotal = editLines.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  const editVatAmount = editSubtotal * (vatRate / 100);
  const editTotal = editSubtotal + editVatAmount;

  const getStatus = () => {
    if (inv.status === 'overdue') return 'overdue';
    if (inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && inv.due_date) {
      if (isBefore(startOfDay(new Date(inv.due_date)), startOfDay(new Date())) && !inv.paid_date) return 'overdue';
    }
    return inv.status;
  };
  const status = getStatus();

  const handleSaveEdit = async () => {
    try {
      await updateInvoice.mutateAsync({
        id: inv.id,
        invoice_number: editData.invoice_number || undefined,
        issued_date: editData.issued_date || null,
        due_date: editData.due_date || null,
        notes: editData.notes || null,
        amount: editSubtotal,
      });

      // Delete existing line items and recreate
      for (const li of lineItems) {
        await deleteLineItem.mutateAsync({ id: li.id, invoiceId: inv.id });
      }
      for (let i = 0; i < editLines.length; i++) {
        const line = editLines[i];
        if (!line.description && line.unit_price === 0) continue;
        await createLineItem.mutateAsync({
          workspace_id: workspaceId!,
          invoice_id: inv.id,
          sort_order: i,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_total: line.quantity * line.unit_price,
        });
      }
      toast.success('Invoice updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status & Actions Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`${STATUS_STYLES[status] ?? 'bg-muted'} border-0 capitalize text-sm px-3 py-1`}>
          {status}
        </Badge>
        <div className="flex-1" />
        {!editing ? (
          <>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onDuplicate(inv)}>
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </Button>
            {status !== 'paid' && status !== 'void' && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onAction(inv, 'sent')}>
                  <Send className="w-3.5 h-3.5" /> Send
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => onAction(inv, 'paid')}>
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-destructive" onClick={() => onAction(inv, 'void')}>
              <Ban className="w-3.5 h-3.5" /> Void
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit}>Save Changes</Button>
          </>
        )}
      </div>

      {/* Invoice Document */}
      <div className="border border-border rounded-xl bg-card p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-lg font-bold text-foreground">CLIENT MAPPER</p>
            <p className="text-xs text-muted-foreground mt-0.5">My Workspace</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Bill To:</p>
            <p className="text-sm font-semibold text-foreground">{inv.companies?.name ?? '—'}</p>
            {inv.engagements?.name && <p className="text-xs text-muted-foreground">{inv.engagements.name}</p>}
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm border-t border-b border-border/50 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Invoice #</p>
            {editing ? (
              <Input value={editData.invoice_number} onChange={(e) => setEditData(prev => ({ ...prev, invoice_number: e.target.value }))}
                className="h-8 text-sm mt-1" />
            ) : (
              <p className="font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Issue Date</p>
            {editing ? (
              <Input type="date" value={editData.issued_date} onChange={(e) => setEditData(prev => ({ ...prev, issued_date: e.target.value }))}
                className="h-8 text-sm mt-1" />
            ) : (
              <p className="font-medium text-foreground">{inv.issued_date ? format(new Date(inv.issued_date), 'dd MMM yyyy') : '—'}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            {editing ? (
              <Input type="date" value={editData.due_date} onChange={(e) => setEditData(prev => ({ ...prev, due_date: e.target.value }))}
                className="h-8 text-sm mt-1" />
            ) : (
              <p className={`font-medium ${status === 'overdue' ? 'text-destructive' : 'text-foreground'}`}>
                {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment Terms</p>
            <p className="font-medium text-foreground">30 days</p>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-right py-2 font-medium text-muted-foreground w-16">Qty</th>
                <th className="text-right py-2 font-medium text-muted-foreground w-24">Rate</th>
                <th className="text-right py-2 font-medium text-muted-foreground w-24">Amount</th>
                {editing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {editing ? (
                <>
                  {editLines.map((line, idx) => (
                    <tr key={idx} className="border-b border-border/30">
                      <td className="py-2 pr-2">
                        <Input value={line.description} onChange={(e) => { const n = [...editLines]; n[idx].description = e.target.value; setEditLines(n); }}
                          className="h-8 text-sm" placeholder="Line item description" />
                      </td>
                      <td className="py-2 px-1">
                        <Input type="number" value={line.quantity} onChange={(e) => { const n = [...editLines]; n[idx].quantity = Number(e.target.value) || 0; setEditLines(n); }}
                          className="h-8 text-sm text-right w-16" />
                      </td>
                      <td className="py-2 px-1">
                        <Input type="number" value={line.unit_price} onChange={(e) => { const n = [...editLines]; n[idx].unit_price = Number(e.target.value) || 0; setEditLines(n); }}
                          className="h-8 text-sm text-right w-24" />
                      </td>
                      <td className="py-2 pl-1 text-right font-medium text-foreground">
                        £{(line.quantity * line.unit_price).toLocaleString()}
                      </td>
                      <td className="py-2">
                        {editLines.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="py-2">
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setEditLines([...editLines, { description: '', quantity: 1, unit_price: 0 }])}>
                        <Plus className="w-3 h-3" /> Add Line Item
                      </Button>
                    </td>
                  </tr>
                </>
              ) : lineItems.length > 0 ? (
                lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-border/30">
                    <td className="py-2 text-foreground">{li.description}</td>
                    <td className="py-2 text-right text-muted-foreground">{li.quantity}</td>
                    <td className="py-2 text-right text-muted-foreground">£{li.unit_price.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-foreground">£{li.line_total.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-border/30">
                  <td className="py-2 text-foreground">Invoice total</td>
                  <td className="py-2 text-right text-muted-foreground">1</td>
                  <td className="py-2 text-right text-muted-foreground">£{inv.amount.toLocaleString()}</td>
                  <td className="py-2 text-right font-medium text-foreground">£{inv.amount.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground">£{(editing ? editSubtotal : subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                VAT
                {editing ? (
                  <Select value={String(vatRate)} onValueChange={(v) => setVatRate(Number(v))}>
                    <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VAT_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span>({vatRate}%):</span>
                )}
              </span>
              <span className="font-medium text-foreground">£{(editing ? editVatAmount : vatAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold text-foreground">TOTAL:</span>
              <span className="text-lg font-bold text-foreground">£{(editing ? editTotal : total).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {editing ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Notes / Payment Instructions</p>
            <Textarea value={editData.notes} onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              className="text-sm" rows={3} placeholder="Bank details, payment instructions..." />
          </div>
        ) : inv.notes ? (
          <div className="border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{inv.notes}</p>
          </div>
        ) : null}

        {/* Paid info */}
        {inv.paid_date && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800 dark:text-green-200">Paid on {format(new Date(inv.paid_date), 'dd MMM yyyy')}</span>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-2 pt-2 border-t border-border pb-20">
        {inv.engagement_id && (
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { onClose(); navigate(`/projects/${inv.engagement_id}`); }}>
            View Project
          </Button>
        )}
        {inv.company_id && (
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => { onClose(); navigate(`/companies/${inv.company_id}`); }}>
            <Building2 className="w-3.5 h-3.5" /> View Company
          </Button>
        )}
      </div>
    </div>
  );
}

const AccountsBillingHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { data: invoices = [], isLoading } = useInvoices(currentWorkspace?.id);
  const updateInvoice = useUpdateInvoice();
  const createInvoice = useCreateInvoice();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('filter') || 'all');
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const today = startOfDay(new Date());
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);

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
        setSelectedInvoice(null);
      } else if (action === 'sent') {
        await updateInvoice.mutateAsync({ id: inv.id, status: 'sent' });
        toast.success('Invoice marked as sent');
      } else if (action === 'void') {
        await updateInvoice.mutateAsync({ id: inv.id, status: 'void' });
        toast.success('Invoice voided');
        setSelectedInvoice(null);
      }
    } catch { toast.error('Failed to update invoice'); }
  };

  const handleDuplicate = async (inv: Invoice) => {
    if (!currentWorkspace?.id) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dueStr = addDays(new Date(), 30).toISOString().split('T')[0];
      const result = await createInvoice.mutateAsync({
        workspace_id: currentWorkspace.id,
        company_id: inv.company_id,
        engagement_id: inv.engagement_id,
        status: 'draft',
        amount: inv.amount,
        currency: inv.currency,
        issued_date: todayStr,
        due_date: dueStr,
        notes: inv.notes,
      });
      toast.success('Invoice duplicated as Draft');
      // Open the new invoice in edit mode
      const newInv: Invoice = { ...inv, ...result, status: 'draft', issued_date: todayStr, due_date: dueStr, paid_date: null };
      setSelectedInvoice(newInv);
    } catch { toast.error('Failed to duplicate invoice'); }
  };

  const getStatus = (inv: Invoice) => {
    if (inv.status === 'overdue') return 'overdue';
    if (inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'draft' && inv.due_date) {
      if (isBefore(startOfDay(new Date(inv.due_date)), today) && !inv.paid_date) return 'overdue';
    }
    return inv.status;
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6" data-jarvis-id="accounts-page">
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
            <div data-jarvis-id="accounts-kpi-overdue">
              <KPICard title="Overdue" value={`£${kpis.overdue.toLocaleString()}`}
                subtitle={`${kpis.overdueCount} overdue`} color="bg-destructive"
                active={statusFilter === 'overdue'}
                onClick={() => { setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue'); setCompanyFilter(null); }} />
            </div>
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
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" data-jarvis-id="accounts-client-balances">
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
                        const balanceStatus = hasOverdue ? (c.total > 10000 ? 'At Risk' : 'Overdue') : 'Outstanding';
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
                              <Badge className={`text-[10px] border-0 ${balanceStatus === 'At Risk' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 font-bold' : balanceStatus === 'Overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}`}>
                                {balanceStatus}
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
          <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" data-jarvis-id="accounts-invoice-list">
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
                      const invStatus = getStatus(inv);
                      return (
                        <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                          <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.companies?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.engagements?.name ?? '—'}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{inv.currency} {inv.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-[10px] border-0 capitalize ${STATUS_STYLES[invStatus] ?? 'bg-muted text-muted-foreground'}`}>{invStatus}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{inv.issued_date ? format(new Date(inv.issued_date), 'dd MMM yyyy') : '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {inv.due_date ? (
                              <span className={invStatus === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                {format(new Date(inv.due_date), 'dd MMM yyyy')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedInvoice(inv)}><Eye className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDuplicate(inv)}><Copy className="w-3.5 h-3.5" /></Button>
                              {invStatus !== 'paid' && invStatus !== 'void' && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction(inv, 'paid')}><CheckCircle className="w-3.5 h-3.5 text-green-600" /></Button>
                              )}
                              {invStatus === 'draft' && (
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
              <div className="mt-4">
                <InvoiceDetailPanel
                  invoice={selectedInvoice}
                  onClose={() => setSelectedInvoice(null)}
                  onAction={handleAction}
                  onDuplicate={handleDuplicate}
                  workspaceId={currentWorkspace?.id}
                />
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
