import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { useSows, type Sow } from '@/hooks/use-sows';
import { useInvoices, useUpdateInvoice, type Invoice } from '@/hooks/use-invoices';
import { useDeals, useUpdateDeal, type Deal, DEAL_STAGES, DEAL_STAGE_LABELS } from '@/hooks/use-deals';
import { useOutreachMetrics, type OutreachActionItem } from '@/hooks/use-outreach-metrics';
import { useInvoicePlans } from '@/hooks/use-invoice-plans';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/integrations/supabase/client';
import { CreateEngagementModal } from '@/components/home/CreateEngagementModal';
import { CreateSowModal } from '@/components/home/CreateSowModal';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import { CreateDealModal } from '@/components/home/CreateDealModal';
import { SowDetailSheet } from '@/components/home/SowDetailSheet';

import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Briefcase,
  TrendingUp,
  FileText,
  CalendarClock,
  Plus,
  Building2,
  ArrowRight,
  LayoutGrid,
  Clock,
  Receipt,
  Loader2,
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Target,
  Phone,
  Users,
  Zap,
  Video,
  CheckSquare,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays, addDays, isBefore, startOfDay } from 'date-fns';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ─── Types ─── */
interface CriticalDateItem {
  id: string;
  type: 'renewal' | 'end' | 'invoice_due' | 'invoice_overdue' | 'deal_next_step' | 'outreach_action' | 'call_followup';
  date: Date;
  label: string;
  companyName: string;
  sowRef: string | null;
  sow?: Sow;
  invoice?: Invoice;
  deal?: Deal;
  overdue: boolean;
  daysUntil: number;
}

/* ─── KPI Card ─── */
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentClass: string;
}) {
  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${accentClass} bg-opacity-10`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Empty-State Panel ─── */
function EmptyPanel({
  title,
  description,
  icon: Icon,
  ctas,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  ctas: { label: string; to?: string; onClick?: () => void; variant?: 'default' | 'outline' }[];
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[220px]">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      <div className="flex items-center gap-2 mt-4">
        {ctas.map((cta) =>
          cta.to ? (
            <Button key={cta.label} variant={cta.variant ?? 'default'} size="sm" asChild>
              <Link to={cta.to} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {cta.label}
              </Link>
            </Button>
          ) : (
            <Button key={cta.label} variant={cta.variant ?? 'default'} size="sm" onClick={cta.onClick} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {cta.label}
            </Button>
          )
        )}
      </div>
    </Card>
  );
}

/* ─── Pipeline Stage ─── */
function PipelineStage({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex-1 min-w-[120px] bg-muted/50 rounded-lg p-4 text-center">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">{count}</p>
    </div>
  );
}

/* ─── Critical Date Row ─── */
function CriticalDateRow({ item, onClick }: { item: CriticalDateItem; onClick: () => void }) {
  const isInvoice = item.type === 'invoice_due' || item.type === 'invoice_overdue';
  const isDeal = item.type === 'deal_next_step';
  const isOutreach = item.type === 'outreach_action' || item.type === 'call_followup';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg group"
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.overdue ? 'bg-destructive/10' : isOutreach ? 'bg-primary/10' : isDeal ? 'bg-accent/10' : isInvoice ? 'bg-primary/10' : 'bg-warning/10'}`}>
        {item.overdue ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : isOutreach ? (
          <Phone className="w-4 h-4 text-primary" />
        ) : isDeal ? (
          <Target className="w-4 h-4 text-accent-foreground" />
        ) : isInvoice ? (
          <Receipt className="w-4 h-4 text-primary" />
        ) : (
          <CalendarClock className="w-4 h-4 text-warning" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground">
          {item.sowRef ? `${item.sowRef} · ` : ''}
          {item.overdue
            ? `${Math.abs(item.daysUntil)}d overdue`
            : item.daysUntil === 0
            ? 'Today'
            : `in ${item.daysUntil}d`}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{format(item.date, 'dd MMM')}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-success text-success-foreground',
  amber: 'bg-warning text-warning-foreground',
  red: 'bg-destructive text-destructive-foreground',
};

const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline',
  active: 'Active',
  on_hold: 'On Hold',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

/* ─── Helpers ─── */
function buildCriticalDates(sows: Sow[], invoices: Invoice[], deals: Deal[], windowDays: number): CriticalDateItem[] {
  const today = startOfDay(new Date());
  const items: CriticalDateItem[] = [];

  for (const sow of sows) {
    if (sow.status === 'expired') continue;
    const companyName = sow.companies?.name ?? 'Unknown';

    if (sow.renewal_date) {
      const d = startOfDay(new Date(sow.renewal_date));
      const diff = differenceInDays(d, today);
      if (diff <= windowDays) {
        items.push({
          id: `${sow.id}-renewal`,
          type: 'renewal',
          date: d,
          label: `Renewal — ${companyName}`,
          companyName,
          sowRef: sow.sow_ref,
          sow,
          overdue: isBefore(d, today),
          daysUntil: diff,
        });
      }
    }

    if (sow.end_date) {
      const d = startOfDay(new Date(sow.end_date));
      const diff = differenceInDays(d, today);
      if (diff <= windowDays) {
        items.push({
          id: `${sow.id}-end`,
          type: 'end',
          date: d,
          label: `End — ${companyName}`,
          companyName,
          sowRef: sow.sow_ref,
          sow,
          overdue: isBefore(d, today),
          daysUntil: diff,
        });
      }
    }
  }

  // Invoice due dates
  for (const inv of invoices) {
    if (!inv.due_date || inv.status === 'paid' || inv.status === 'void') continue;
    const d = startOfDay(new Date(inv.due_date));
    const diff = differenceInDays(d, today);
    const isOverdue = isBefore(d, today) && !inv.paid_date;
    if (diff <= windowDays) {
      items.push({
        id: `inv-${inv.id}`,
        type: isOverdue ? 'invoice_overdue' : 'invoice_due',
        date: d,
        label: `Invoice ${inv.invoice_number || '#' + inv.id.slice(0, 6)} — ${inv.companies?.name ?? 'Unknown'}`,
        companyName: inv.companies?.name ?? 'Unknown',
        sowRef: inv.invoice_number,
        invoice: inv,
        overdue: isOverdue,
        daysUntil: diff,
      });
    }
  }

  // Deal next_step_due items
  for (const deal of deals) {
    if (!deal.next_step_due || deal.stage === 'won' || deal.stage === 'lost') continue;
    const d = startOfDay(new Date(deal.next_step_due));
    const diff = differenceInDays(d, today);
    if (diff <= windowDays) {
      items.push({
        id: `deal-${deal.id}`,
        type: 'deal_next_step',
        date: d,
        label: `${deal.next_step || 'Next step'} — ${deal.companies?.name ?? deal.name}`,
        companyName: deal.companies?.name ?? 'Unknown',
        sowRef: null,
        deal,
        overdue: isBefore(d, today),
        daysUntil: diff,
      });
    }
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  });

  return items;
}

function computeBillingSnapshot(invoices: Invoice[]) {
  const today = startOfDay(new Date());
  const next7 = addDays(today, 7);

  let outstandingAmount = 0;
  let outstandingCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let due7Amount = 0;
  let due7Count = 0;

  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue;

    outstandingAmount += inv.amount;
    outstandingCount++;

    if (inv.due_date) {
      const d = startOfDay(new Date(inv.due_date));
      const isOverdue = isBefore(d, today) && !inv.paid_date;
      if (isOverdue || inv.status === 'overdue') {
        overdueAmount += inv.amount;
        overdueCount++;
      }
      if (!isBefore(d, today) && isBefore(d, next7)) {
        due7Amount += inv.amount;
        due7Count++;
      }
    }
  }

  return { outstandingAmount, outstandingCount, overdueAmount, overdueCount, due7Amount, due7Count };
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'outline',
  overdue: 'destructive',
  void: 'secondary',
};

/* ─── Diary Events Section (real diary_events + critical dates) ─── */
function DiaryEventsSection({
  workspaceId,
  diaryItems,
  onItemClick,
}: {
  workspaceId: string | undefined;
  diaryItems: CriticalDateItem[];
  onItemClick: (item: CriticalDateItem) => void;
}) {
  const { data: diaryEvents = [] } = useQuery({
    queryKey: ['diary_events', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const now = new Date();
      const end = addDays(now, 7);
      const { data, error } = await supabase
        .from('diary_events')
        .select('id, title, description, start_time, end_time, event_type, status, candidate_id, contact_id, job_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'scheduled')
        .gte('start_time', now.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time');
      if (error) { console.error('diary_events error:', error); return []; }
      return data || [];
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  const EVENT_ICONS: Record<string, React.ElementType> = {
    call: Phone,
    meeting: Video,
    task: CheckSquare,
  };

  const hasAnyItems = diaryEvents.length > 0 || diaryItems.length > 0;

  if (!hasAnyItems) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[180px]">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <CalendarClock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No events this week</h3>
        <p className="text-xs text-muted-foreground mt-1">Booked calls, meetings and critical dates will appear here.</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border/50">
      {/* Real diary events first */}
      {diaryEvents.map((evt: any) => {
        const Icon = EVENT_ICONS[evt.event_type] || CalendarClock;
        const startDate = new Date(evt.start_time);
        return (
          <div key={evt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{evt.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'EEEE')} · {format(startDate, 'HH:mm')}–{format(new Date(evt.end_time), 'HH:mm')}
                {evt.description ? ` · ${evt.description}` : ''}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{format(startDate, 'dd MMM')}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{evt.event_type}</Badge>
          </div>
        );
      })}
      {/* Critical date items */}
      {diaryItems.slice(0, Math.max(0, 6 - diaryEvents.length)).map((item) => (
        <CriticalDateRow key={item.id} item={item} onClick={() => onItemClick(item)} />
      ))}
      {(diaryEvents.length + diaryItems.length) > 6 && (
        <div className="px-4 py-2 text-center">
          <span className="text-xs text-muted-foreground">+{(diaryEvents.length + diaryItems.length) - 6} more</span>
        </div>
      )}
    </Card>
  );
}

/* ─── Main Page ─── */
const HomeCommandCenter = () => {
  const navigate = useNavigate();
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sowOpen, setSowOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [selectedSow, setSelectedSow] = useState<Sow | null>(null);
  const [sowSheetOpen, setSowSheetOpen] = useState(false);
  const [convertDeal, setConvertDeal] = useState<Deal | null>(null);

  const { data: engagements = [], isLoading: engLoading } = useEngagements(currentWorkspace?.id);
  const { data: sows = [], isLoading: sowsLoading } = useSows(currentWorkspace?.id);
  const { data: invoices = [], isLoading: invLoading } = useInvoices(currentWorkspace?.id);
  const { data: deals = [], isLoading: dealsLoading } = useDeals(currentWorkspace?.id);
  const { data: outreachMetrics } = useOutreachMetrics(currentWorkspace?.id);
  const { data: invoicePlans = [] } = useInvoicePlans(currentWorkspace?.id);
  const { isAdmin, isManager } = usePermissions();
  const queryClient = useQueryClient();
  const [runningDue, setRunningDue] = useState(false);
  const updateInvoice = useUpdateInvoice();
  const updateDeal = useUpdateDeal();

  const activePlansExist = invoicePlans.some(p => p.status === 'active');
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const scheduledTodayCount = invoicePlans.filter(p => p.status === 'active' && p.next_run_date === todayStr).length;
  const blockedPlansCount = invoicePlans.filter(p => p.status === 'active' && !p.fixed_amount && !p.rate_per_day).length;

  const handleRunDueInvoices = async () => {
    if (!currentWorkspace?.id) return;
    setRunningDue(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-run-due-plans', {
        body: { workspace_id: currentWorkspace.id, mode: 'execute' },
      });
      if (error) throw error;
      const created = data?.invoices_created ?? data?.created_count ?? 0;
      const skipped = data?.invoices_skipped ?? data?.skipped_count ?? 0;
      toast.success(`${created} invoice(s) created, ${skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-plans'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to run due invoices');
    } finally {
      setRunningDue(false);
    }
  };

  const activeCount = engagements.filter((e) => e.stage === 'active').length;
  const pipelineCount = engagements.filter((e) => e.stage === 'pipeline').length;

  // Deal pipeline metrics
  const activeDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const totalPipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedPipelineValue = activeDeals.reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  const next30Forecast = useMemo(() => {
    const cutoff = addDays(startOfDay(new Date()), 30);
    return activeDeals
      .filter((d) => d.expected_close_date && !isBefore(cutoff, startOfDay(new Date(d.expected_close_date))))
      .reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  }, [activeDeals]);

  // Build outreach action items for My Work
  const outreachWorkItems: CriticalDateItem[] = useMemo(() => {
    if (!outreachMetrics) return [];
    const items: CriticalDateItem[] = [];
    for (const a of [...outreachMetrics.upcomingActions, ...outreachMetrics.upcomingFollowUps]) {
      items.push({
        id: a.id,
        type: a.source === 'outreach_target' ? 'outreach_action' : 'call_followup',
        date: a.date,
        label: `${a.label} — ${a.entityName}`,
        companyName: a.entityName,
        sowRef: null,
        overdue: a.overdue,
        daysUntil: a.daysUntil,
      });
    }
    return items;
  }, [outreachMetrics]);

  // Critical dates: My Work = 30 days, Diary = 7 days (includes invoices + deals + outreach)
  const myWorkItems = useMemo(() => {
    const base = buildCriticalDates(sows, invoices, deals, 30);
    const all = [...base, ...outreachWorkItems];
    all.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
    return all;
  }, [sows, invoices, deals, outreachWorkItems]);
  const diaryItems = useMemo(() => {
    const base = buildCriticalDates(sows, invoices, deals, 7);
    const outreach7 = outreachWorkItems.filter(i => i.daysUntil <= 7);
    const all = [...base, ...outreach7];
    all.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.date.getTime() - b.date.getTime();
    });
    return all;
  }, [sows, invoices, deals, outreachWorkItems]);

  const renewalCount = myWorkItems.length;
  const overdueCount = myWorkItems.filter((i) => i.overdue).length;

  const billing = useMemo(() => computeBillingSnapshot(invoices), [invoices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshWorkspaces();
    setTimeout(() => setRefreshing(false), 600);
  };

  const openSowDetail = (sow: Sow) => {
    setSelectedSow(sow);
    setSowSheetOpen(true);
  };

  const handleItemClick = (item: CriticalDateItem) => {
    if (item.sow) {
      if (item.sow.engagement_id) {
        navigate(`/projects/${item.sow.engagement_id}`);
        return;
      }
      openSowDetail(item.sow);
      return;
    }
    if (item.invoice?.engagement_id) {
      navigate(`/projects/${item.invoice.engagement_id}`);
    }
  };

  const handleMarkOverdue = async (inv: Invoice) => {
    try {
      await updateInvoice.mutateAsync({ id: inv.id, status: 'overdue' });
      toast.success('Invoice marked as overdue');
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    try {
      await updateInvoice.mutateAsync({ id: inv.id, status: 'paid', paid_date: new Date().toISOString().split('T')[0] });
      toast.success('Invoice marked as paid');
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentWorkspace?.name ?? 'Workspace'} &middot; Today&rsquo;s overview
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Projects"
          value={activeCount > 0 ? String(activeCount) : '—'}
          subtitle={activeCount > 0 ? `${activeCount} active` : 'No projects yet'}
          icon={Briefcase}
          accentClass="bg-primary"
        />
        <KPICard
          title="Deal Pipeline"
          value={activeDeals.length > 0 ? `£${totalPipelineValue.toLocaleString()}` : '—'}
          subtitle={activeDeals.length > 0 ? `${activeDeals.length} deals · £${weightedPipelineValue.toLocaleString()} weighted` : 'No deals yet'}
          icon={TrendingUp}
          accentClass="bg-accent"
        />
        <KPICard
          title="Outstanding Invoices"
          value={billing.outstandingCount > 0 ? `£${billing.outstandingAmount.toLocaleString()}` : '—'}
          subtitle={billing.outstandingCount > 0 ? `${billing.outstandingCount} unpaid` : 'No outstanding invoices'}
          icon={Receipt}
          accentClass="bg-warning"
        />
        <KPICard
          title="Renewals & Key Dates"
          value={renewalCount > 0 ? String(renewalCount) : '—'}
          subtitle={overdueCount > 0 ? `${overdueCount} overdue` : renewalCount > 0 ? `${renewalCount} upcoming` : 'Nothing upcoming'}
          icon={CalendarClock}
          accentClass="bg-success"
        />
      </div>

      {/* ── Outreach Mini-Metrics ── */}
      {outreachMetrics && outreachMetrics.totalTargets > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Queued', value: outreachMetrics.queued },
            { label: 'Contacted', value: outreachMetrics.contacted },
            { label: 'Responded', value: outreachMetrics.responded },
            { label: 'Booked', value: outreachMetrics.booked },
            { label: 'Response Rate', value: `${(outreachMetrics.responseRate * 100).toFixed(0)}%` },
            { label: 'Booking Rate', value: `${(outreachMetrics.bookingRate * 100).toFixed(0)}%` },
            { label: 'Calls (7d)', value: Object.values(outreachMetrics.callOutcomesLast7).reduce((s, v) => s + v, 0) },
          ].map((m) => (
            <Card key={m.label} className="p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Call Outcomes (7d) ── */}
      {outreachMetrics && Object.keys(outreachMetrics.callOutcomesLast7).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider self-center mr-2">Call Outcomes (7d)</span>
          {Object.entries(outreachMetrics.callOutcomesLast7).map(([outcome, count]) => (
            <Badge key={outcome} variant="secondary" className="text-xs capitalize">
              {outcome.replace('_', ' ')}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* ── My Work + Diary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Work: 30 day window */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-jarvis-id="home-my-work">My Work</h2>
            <div className="flex items-center gap-2">
              {scheduledTodayCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Zap className="w-3 h-3" />
                  {scheduledTodayCount} invoice{scheduledTodayCount !== 1 ? 's' : ''} scheduled today
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">{myWorkItems.length} items</Badge>
            </div>
          </div>
          {myWorkItems.length === 0 ? (
            <EmptyPanel
              title="No tasks or critical dates"
              description="Upcoming renewals, invoice due dates and overdue items will appear here."
              icon={Clock}
              ctas={[
                { label: 'Add SOW', onClick: () => setSowOpen(true) },
                { label: 'Create Invoice', onClick: () => setInvoiceOpen(true), variant: 'outline' },
              ]}
            />
          ) : (
            <Card className="divide-y divide-border/50">
              {myWorkItems.slice(0, 8).map((item) => (
                <CriticalDateRow
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
              {myWorkItems.length > 8 && (
                <div className="px-4 py-2 text-center">
                  <span className="text-xs text-muted-foreground">+{myWorkItems.length - 8} more items</span>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Diary: Real diary_events + critical dates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-jarvis-id="home-diary">Diary</h2>
            <Badge variant="secondary" className="text-xs">Next 7 days</Badge>
          </div>
          <DiaryEventsSection workspaceId={currentWorkspace?.id} diaryItems={diaryItems} onItemClick={handleItemClick} />
        </div>
      </div>

      {/* ── Billing Alerts ── */}
      {(scheduledTodayCount > 0 || blockedPlansCount > 0 || billing.overdueCount > 0) && (
        <section>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Billing Alerts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scheduledTodayCount > 0 && (
              <Card className="border-primary/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{scheduledTodayCount} invoice{scheduledTodayCount !== 1 ? 's' : ''} due to generate</p>
                    <p className="text-xs text-muted-foreground">Scheduled for today</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {blockedPlansCount > 0 && (
              <Card className="border-warning/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{blockedPlansCount} blocked plan{blockedPlansCount !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">Missing amount configuration</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {billing.overdueCount > 0 && (
              <Card className="border-destructive/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">£{billing.overdueAmount.toLocaleString()} overdue</p>
                    <p className="text-xs text-muted-foreground">{billing.overdueCount} invoice{billing.overdueCount !== 1 ? 's' : ''}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ── Billing Snapshot ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-jarvis-id="home-billing-snapshot">Billing Snapshot</h2>
            {activePlansExist && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Zap className="w-3 h-3" />
                Auto-billing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || isManager) && activePlansExist && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleRunDueInvoices}
                disabled={runningDue}
              >
                {runningDue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Run due invoices
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setInvoiceOpen(true)} data-jarvis-id="home-create-invoice-button">
              <Plus className="w-3.5 h-3.5" />
              Create Invoice
            </Button>
          </div>
        </div>

        {invLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : invoices.length === 0 ? (
          <EmptyPanel
            title="No invoices yet"
            description="Track outstanding invoices, payments and billing milestones here."
            icon={Receipt}
            ctas={[
              { label: 'Create Invoice', onClick: () => setInvoiceOpen(true) },
              { label: 'View Companies', to: '/companies', variant: 'outline' },
            ]}
          />
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Outstanding</p>
                  <p className="text-xl font-bold text-foreground mt-1">£{billing.outstandingAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{billing.outstandingCount} invoice{billing.outstandingCount !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card className={billing.overdueCount > 0 ? 'border-destructive/30' : ''}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue</p>
                  <p className={`text-xl font-bold mt-1 ${billing.overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}>£{billing.overdueAmount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{billing.overdueCount} invoice{billing.overdueCount !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Next 7 Days</p>
                  <p className="text-xl font-bold text-foreground mt-1">£{billing.due7Amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{billing.due7Count} invoice{billing.due7Count !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
            </div>

            {/* Invoice table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const today = startOfDay(new Date());
                      const isComputedOverdue = inv.status === 'sent' && inv.due_date && isBefore(startOfDay(new Date(inv.due_date)), today) && !inv.paid_date;
                      return (
                        <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{inv.companies?.name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_BADGE_VARIANT[inv.status] ?? 'secondary'} className="text-xs capitalize">
                              {isComputedOverdue && inv.status !== 'overdue' ? 'overdue' : inv.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {inv.currency} {inv.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {(isComputedOverdue && inv.status !== 'overdue') && (
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleMarkOverdue(inv)}>
                                  Mark Overdue
                                </Button>
                              )}
                              {inv.status !== 'paid' && inv.status !== 'void' && (
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleMarkPaid(inv)}>
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* ── SOWs & Renewals ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">SOWs & Contracts</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setSowOpen(true)} data-jarvis-id="home-add-sow-button">
            <Plus className="w-3.5 h-3.5" />
            Add SOW
          </Button>
        </div>

        {sowsLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : sows.length === 0 ? (
          <EmptyPanel
            title="No SOWs or contracts"
            description="Add statements of work to track renewals, billing and contract health."
            icon={FileText}
            ctas={[
              { label: 'Add SOW', onClick: () => setSowOpen(true) },
              { label: 'View Companies', to: '/companies', variant: 'outline' },
            ]}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {sows.map((sow) => (
                    <tr
                      key={sow.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openSowDetail(sow)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{sow.sow_ref || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sow.companies?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={sow.status === 'signed' ? 'default' : sow.status === 'expired' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                          {sow.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">{sow.billing_model.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sow.value > 0 ? `${sow.currency} ${sow.value.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {sow.end_date ? format(new Date(sow.end_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {sow.renewal_date ? format(new Date(sow.renewal_date), 'dd MMM yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* ── Active Projects Table ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Projects</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)} data-jarvis-id="home-create-project-button">
            <Plus className="w-3.5 h-3.5" />
            Create Project
          </Button>
        </div>

        {engLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : engagements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                <LayoutGrid className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No active projects</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Create a project to track placements, engagements and deliverables across your client base.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Create Project
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/companies" className="gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Add Company
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Forecast</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {engagements.map((eng) => (
                    <tr key={eng.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${eng.id}`)}>
                      <td className="px-4 py-3 font-medium text-foreground">{eng.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{eng.companies?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs capitalize">{eng.engagement_type.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{STAGE_LABELS[eng.stage] ?? eng.stage}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[eng.health]?.split(' ')[0] ?? 'bg-muted'}`} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {eng.forecast_value > 0 ? `${eng.currency} ${eng.forecast_value.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(eng.updated_at), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* ── Pipeline Snapshot (Deals Kanban) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider" data-jarvis-id="home-pipeline-snapshot">Pipeline Snapshot</h2>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Total: £{totalPipelineValue.toLocaleString()} · Weighted: £{weightedPipelineValue.toLocaleString()} · 30d forecast: £{next30Forecast.toLocaleString()}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setDealOpen(true)} data-jarvis-id="home-create-deal-button">
              <Plus className="w-3.5 h-3.5" />
              Create Deal
            </Button>
          </div>
        </div>

        {dealsLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : deals.length === 0 ? (
          <EmptyPanel
            title="No deals in pipeline"
            description="Track consulting and recruitment deals through your sales pipeline."
            icon={Target}
            ctas={[
              { label: 'Create Deal', onClick: () => setDealOpen(true) },
              { label: 'View Companies', to: '/companies', variant: 'outline' },
            ]}
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {DEAL_STAGES.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage);
              const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
              return (
                <div key={stage} className="min-w-[200px] flex-1">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{DEAL_STAGE_LABELS[stage]}</span>
                    <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                  </div>
                  {stageTotal > 0 && (
                    <p className="text-xs text-muted-foreground px-1 mb-2">£{stageTotal.toLocaleString()}</p>
                  )}
                  <div className="space-y-2">
                    {stageDeals.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <p className="text-xs text-muted-foreground">No deals</p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => {
                        const stageIdx = DEAL_STAGES.indexOf(deal.stage as any);
                        const nextStage = stageIdx >= 0 && stageIdx < DEAL_STAGES.length - 2 ? DEAL_STAGES[stageIdx + 1] : null;
                        return (
                          <Card key={deal.id} className="p-3 hover:shadow-sm transition-shadow">
                            <p className="text-sm font-medium text-foreground truncate">{deal.name}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{deal.companies?.name ?? '—'}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-medium text-foreground">£{deal.value.toLocaleString()}</span>
                              <Badge variant="outline" className="text-xs">{deal.probability}%</Badge>
                            </div>
                            {deal.expected_close_date && (
                              <p className="text-xs text-muted-foreground mt-1">Close: {format(new Date(deal.expected_close_date), 'dd MMM')}</p>
                            )}
                            {/* Deal actions */}
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
                              {nextStage && deal.stage !== 'won' && deal.stage !== 'lost' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateDeal.mutateAsync({ id: deal.id, stage: nextStage });
                                    toast.success(`Moved to ${DEAL_STAGE_LABELS[nextStage]}`);
                                  }}
                                >
                                  → {DEAL_STAGE_LABELS[nextStage]}
                                </Button>
                              )}
                              {deal.stage === 'won' && !deal.engagement_id && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-6 text-[10px] px-2 gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConvertDeal(deal);
                                    setCreateOpen(true);
                                  }}
                                >
                                  <Briefcase className="w-3 h-3" />
                                  Create Project
                                </Button>
                              )}
                              {deal.stage === 'won' && deal.engagement_id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2 gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${deal.engagement_id}`);
                                  }}
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  View Project
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      {/* ── Modals ── */}
      <CreateEngagementModal
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setConvertDeal(null);
        }}
        prefillCompanyId={convertDeal?.company_id}
        prefillDealId={convertDeal?.id}
        prefillName={convertDeal ? `${convertDeal.name} — Delivery` : undefined}
        prefillValue={convertDeal?.value}
      />
      <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <CreateDealModal open={dealOpen} onOpenChange={setDealOpen} />
      <SowDetailSheet sow={selectedSow} open={sowSheetOpen} onOpenChange={setSowSheetOpen} />
    </div>
  );
};

export default HomeCommandCenter;
