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
import { ReportBuilderPanel, type ReportType } from '@/components/home/ReportBuilderPanel';
import { useJarvisNavigation } from '@/hooks/use-jarvis-navigation';
import { GuidedTourPlayer } from '@/components/jarvis/GuidedTourPlayer';
import type { GuidedTourStep } from '@/hooks/use-jarvis';

import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, Briefcase, TrendingUp, FileText, CalendarClock,
  Plus, Building2, ArrowRight, LayoutGrid, Clock, Receipt, Loader2,
  AlertTriangle, ChevronRight, ChevronDown, DollarSign, Target, Phone,
  Users, Zap, Video, CheckSquare, Inbox, Send, FileBarChart, Compass,
  ArrowUpRight,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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

/* ─── Section Header ─── */
function SectionHeader({
  title,
  icon: Icon,
  accentColor,
  jarvisId,
  children,
}: {
  title: string;
  icon: React.ElementType;
  accentColor: string;
  jarvisId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3" data-jarvis-id={jarvisId}>
      <div className="flex items-center gap-2.5">
        <div className={`w-1 h-5 rounded-full ${accentColor}`} />
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ title, value, subtitle, icon: Icon, accentClass, onClick }: {
  title: string; value: string; subtitle: string; icon: React.ElementType; accentClass: string; onClick?: () => void;
}) {
  return (
    <Card
      className={`relative overflow-hidden group border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${accentClass} bg-opacity-10`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {onClick && (
          <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3" />
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Empty-State Panel ─── */
function EmptyPanel({ title, description, icon: Icon, ctas }: {
  title: string; description: string; icon: React.ElementType;
  ctas: { label: string; to?: string; onClick?: () => void; variant?: 'default' | 'outline' }[];
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[220px] border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      <div className="flex items-center gap-2 mt-4">
        {ctas.map((cta) =>
          cta.to ? (
            <Button key={cta.label} variant={cta.variant ?? 'default'} size="sm" asChild>
              <Link to={cta.to} className="gap-1.5"><Plus className="w-3.5 h-3.5" />{cta.label}</Link>
            </Button>
          ) : (
            <Button key={cta.label} variant={cta.variant ?? 'default'} size="sm" onClick={cta.onClick} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />{cta.label}
            </Button>
          )
        )}
      </div>
    </Card>
  );
}

/* ─── Pipeline Chevron Stage ─── */
const CHEVRON_COLORS: Record<string, string> = {
  lead: '#3B82F6', qualified: '#6366F1', proposal: '#F59E0B',
  negotiation: '#F97316', won: '#22C55E', lost: '#EF4444',
};

function PipelineChevron({ stage, label, count, total, isFirst, isLast, isActive, onClick, cascadeIndex }: {
  stage: string; label: string; count: number; total: number; isFirst: boolean; isLast: boolean; isActive: boolean; onClick: () => void; cascadeIndex?: number;
}) {
  const color = CHEVRON_COLORS[stage] ?? '#6B7280';
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cascadeIndex === undefined) return;
    const already = sessionStorage.getItem('pipeline_cascade_done');
    if (already) return;

    const el = ref.current;
    if (!el) return;

    // Start dim
    el.style.filter = 'brightness(0.6)';
    el.style.transition = 'filter 0.25s ease, transform 0.25s ease';

    const t1 = setTimeout(() => {
      el.style.filter = 'brightness(1.4) saturate(1.3)';
      el.style.transform = 'scale(1.04)';
      // Pulse count
      const countEl = el.querySelector('[data-chevron-count]') as HTMLElement;
      if (countEl) {
        countEl.style.transition = 'transform 0.2s ease';
        countEl.style.transform = 'scale(1.3)';
        setTimeout(() => { countEl.style.transform = 'scale(1)'; }, 200);
      }
    }, cascadeIndex * 180);

    const t2 = setTimeout(() => {
      el.style.filter = count > 0 ? 'brightness(1.05)' : 'brightness(0.85)';
      el.style.transform = 'scale(1)';
      el.style.opacity = count > 0 ? '1' : '0.7';
    }, cascadeIndex * 180 + 400);

    // Mark done after last stage
    const t3 = setTimeout(() => {
      sessionStorage.setItem('pipeline_cascade_done', 'true');
    }, 6 * 180 + 500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cascadeIndex, count]);

  return (
    <button ref={ref} onClick={onClick} className="relative flex-1 min-w-[130px] transition-all duration-200 group"
      style={{ filter: isActive ? 'brightness(1)' : 'brightness(0.85)', opacity: isActive ? 1 : 0.75 }}>
      <svg viewBox="0 0 200 56" preserveAspectRatio="none" className="w-full h-14" aria-hidden>
        <polygon
          points={isFirst ? '0,0 180,0 200,28 180,56 0,56' : isLast ? '0,0 180,0 200,0 200,56 180,56 0,56 20,28' : '0,0 180,0 200,28 180,56 0,56 20,28'}
          fill={color} className="transition-all duration-200 group-hover:brightness-110"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2">
        <span className="text-[10px] font-semibold text-white uppercase tracking-wider leading-none">{label}</span>
        <span data-chevron-count className="text-lg font-bold text-white leading-tight mt-0.5">{count}</span>
        <span className="text-[9px] text-white/80 leading-none">£{total.toLocaleString()}</span>
      </div>
    </button>
  );
}

/* ─── Deal Card for Pipeline ─── */
function PipelineDealCard({ deal, onAdvance, onCreateProject, onViewProject, isRecruitment }: {
  deal: Deal; onAdvance?: (nextStage: string) => void; onCreateProject?: () => void; onViewProject?: () => void; isRecruitment: boolean;
}) {
  const today = startOfDay(new Date());
  const createdDate = startOfDay(new Date(deal.updated_at));
  const daysInStage = Math.max(0, differenceInDays(today, createdDate));
  const stageIdx = DEAL_STAGES.indexOf(deal.stage as any);
  const nextStage = stageIdx >= 0 && stageIdx < DEAL_STAGES.length - 2 ? DEAL_STAGES[stageIdx + 1] : null;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground truncate flex-1">{deal.name}</p>
        {isRecruitment && (
          <span className="shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--accent))] text-accent-foreground text-[10px] font-bold flex items-center justify-center">R</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.companies?.name ?? '—'}</span>
        <span className="font-medium text-foreground">£{deal.value.toLocaleString()}</span>
        {deal.expected_close_date && <span>{format(new Date(deal.expected_close_date), 'dd MMM')}</span>}
        <span className="ml-auto tabular-nums">{daysInStage}d in stage</span>
      </div>
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
        {nextStage && deal.stage !== 'won' && deal.stage !== 'lost' && onAdvance && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onAdvance(nextStage)}>
            → {DEAL_STAGE_LABELS[nextStage]}
          </Button>
        )}
        {deal.stage === 'won' && !deal.engagement_id && onCreateProject && (
          <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1" onClick={onCreateProject}>
            <Briefcase className="w-3 h-3" /> Create Project
          </Button>
        )}
        {deal.stage === 'won' && deal.engagement_id && onViewProject && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={onViewProject}>
            <ArrowRight className="w-3 h-3" /> View Project
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ─── Critical Date Row ─── */
function CriticalDateRow({ item, onClick }: { item: CriticalDateItem; onClick: () => void }) {
  const isInvoice = item.type === 'invoice_due' || item.type === 'invoice_overdue';
  const isDeal = item.type === 'deal_next_step';
  const isOutreach = item.type === 'outreach_action' || item.type === 'call_followup';
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg group">
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.overdue ? 'bg-destructive/10' : isOutreach ? 'bg-primary/10' : isDeal ? 'bg-accent/10' : isInvoice ? 'bg-primary/10' : 'bg-warning/10'}`}>
        {item.overdue ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
         isOutreach ? <Phone className="w-4 h-4 text-primary" /> :
         isDeal ? <Target className="w-4 h-4 text-accent-foreground" /> :
         isInvoice ? <Receipt className="w-4 h-4 text-primary" /> :
         <CalendarClock className="w-4 h-4 text-warning" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground">
          {item.sowRef ? `${item.sowRef} · ` : ''}
          {item.overdue ? `${Math.abs(item.daysUntil)}d overdue` : item.daysUntil === 0 ? 'Today' : `in ${item.daysUntil}d`}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{format(item.date, 'dd MMM')}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-success text-success-foreground', amber: 'bg-warning text-warning-foreground', red: 'bg-destructive text-destructive-foreground',
};
const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline', active: 'Active', on_hold: 'On Hold', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
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
      if (diff <= windowDays) items.push({ id: `${sow.id}-renewal`, type: 'renewal', date: d, label: `Renewal — ${companyName}`, companyName, sowRef: sow.sow_ref, sow, overdue: isBefore(d, today), daysUntil: diff });
    }
    if (sow.end_date) {
      const d = startOfDay(new Date(sow.end_date));
      const diff = differenceInDays(d, today);
      if (diff <= windowDays) items.push({ id: `${sow.id}-end`, type: 'end', date: d, label: `End — ${companyName}`, companyName, sowRef: sow.sow_ref, sow, overdue: isBefore(d, today), daysUntil: diff });
    }
  }
  for (const inv of invoices) {
    if (!inv.due_date || inv.status === 'paid' || inv.status === 'void') continue;
    const d = startOfDay(new Date(inv.due_date));
    const diff = differenceInDays(d, today);
    const isOverdue = isBefore(d, today) && !inv.paid_date;
    if (diff <= windowDays) items.push({ id: `inv-${inv.id}`, type: isOverdue ? 'invoice_overdue' : 'invoice_due', date: d, label: `Invoice ${inv.invoice_number || '#' + inv.id.slice(0, 6)} — ${inv.companies?.name ?? 'Unknown'}`, companyName: inv.companies?.name ?? 'Unknown', sowRef: inv.invoice_number, invoice: inv, overdue: isOverdue, daysUntil: diff });
  }
  for (const deal of deals) {
    if (!deal.next_step_due || deal.stage === 'won' || deal.stage === 'lost') continue;
    const d = startOfDay(new Date(deal.next_step_due));
    const diff = differenceInDays(d, today);
    if (diff <= windowDays) items.push({ id: `deal-${deal.id}`, type: 'deal_next_step', date: d, label: `${deal.next_step || 'Next step'} — ${deal.companies?.name ?? deal.name}`, companyName: deal.companies?.name ?? 'Unknown', sowRef: null, deal, overdue: isBefore(d, today), daysUntil: diff });
  }
  items.sort((a, b) => { if (a.overdue !== b.overdue) return a.overdue ? -1 : 1; return a.date.getTime() - b.date.getTime(); });
  return items;
}

function computeBillingSnapshot(invoices: Invoice[]) {
  const today = startOfDay(new Date());
  const next7 = addDays(today, 7);
  let outstandingAmount = 0, outstandingCount = 0, overdueAmount = 0, overdueCount = 0, due7Amount = 0, due7Count = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue;
    outstandingAmount += inv.amount; outstandingCount++;
    if (inv.due_date) {
      const d = startOfDay(new Date(inv.due_date));
      const isOverdue = isBefore(d, today) && !inv.paid_date;
      if (isOverdue || inv.status === 'overdue') { overdueAmount += inv.amount; overdueCount++; }
      if (!isBefore(d, today) && isBefore(d, next7)) { due7Amount += inv.amount; due7Count++; }
    }
  }
  return { outstandingAmount, outstandingCount, overdueAmount, overdueCount, due7Amount, due7Count };
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-transparent',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-transparent',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border-transparent',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border-transparent',
  void: 'bg-muted text-muted-foreground border-transparent',
};

/* ─── Diary Events Section ─── */
function DiaryEventsSection({ workspaceId }: { workspaceId: string | undefined }) {
  const { data: diaryEvents = [] } = useQuery({
    queryKey: ['diary_events', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const now = new Date();
      const end = addDays(now, 7);
      const { data, error } = await supabase
        .from('diary_events')
        .select('id, title, description, start_time, end_time, event_type, status, candidate_id, contact_id, job_id')
        .eq('workspace_id', workspaceId).eq('status', 'scheduled')
        .gte('start_time', now.toISOString()).lte('start_time', end.toISOString())
        .order('start_time');
      if (error) { console.error('diary_events error:', error); return []; }
      return data || [];
    },
    enabled: !!workspaceId, refetchInterval: 30000,
  });
  const EVENT_ICONS: Record<string, React.ElementType> = { call: Phone, meeting: Video, task: CheckSquare };
  if (diaryEvents.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[180px] border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <CalendarClock className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No events this week</h3>
        <p className="text-xs text-muted-foreground mt-1">Booked calls, meetings and tasks will appear here.</p>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-border/50 border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      {diaryEvents.map((evt: any) => {
        const Icon = EVENT_ICONS[evt.event_type] || CalendarClock;
        const startDate = new Date(evt.start_time);
        return (
          <div key={evt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
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
    </Card>
  );
}

/* ─── Command Centre Tour Steps ─── */
const COMMAND_CENTRE_TOUR: GuidedTourStep[] = [
  { speak: "Welcome to your Command Centre. This is the heartbeat of your business.", delay: 2000 },
  { highlight: '[data-jarvis-section="stat-cards"]', speak: "These four cards at the top give you your headline numbers — active projects, pipeline value, outstanding invoices, and renewals." },
  { highlight: '[data-jarvis-section="pipeline-snapshot"]', speak: "Below that is your pipeline snapshot — every deal by stage. Click any stage chevron to see the deals inside." },
  { highlight: '[data-jarvis-section="my-work"]', speak: "My Work shows what needs your attention today — overdue items, shortlists to review, and outreach ready to send." },
  { highlight: '[data-jarvis-section="diary"]', speak: "Your diary shows calls and meetings for the next seven days." },
  { highlight: '[data-jarvis-section="active-projects"]', speak: "Active Projects shows all your live engagements. The Jobs column shows open recruitment roles linked to each project." },
  { highlight: '[data-jarvis-section="alerts-strip"]', speak: "Billing Alerts will flag anything overdue or expiring." },
  { speak: "That is your Command Centre. Everything in one view. Just ask me to take you anywhere or show you anything.", delay: 2000 },
];
const TOUR_CLOSING = "Tour complete.";

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
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPreselect, setReportPreselect] = useState<ReportType | undefined>();
  const [reportAutoDownload, setReportAutoDownload] = useState(false);
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [sowsExpanded, setSowsExpanded] = useState(false);

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

  // Tour
  const jarvisNav = useJarvisNavigation();

  const handleStartTour = useCallback(async () => {
    await jarvisNav.runGuidedTour(COMMAND_CENTRE_TOUR);
    toast.success(TOUR_CLOSING);
  }, [jarvisNav]);

  // Jobs data
  const { data: jobsSummary } = useQuery({
    queryKey: ['jobs_command_centre', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { activeJobs: [], jobWorkItems: [] as CriticalDateItem[] };
      const { data: jobs } = await supabase.from('jobs').select('id, title, status, company_id').eq('workspace_id', currentWorkspace.id).in('status', ['active', 'draft']);
      const activeJobs = jobs ?? [];
      const activeJobIds = activeJobs.filter(j => j.status === 'active').map(j => j.id);
      if (activeJobIds.length === 0) return { activeJobs, jobWorkItems: [] as CriticalDateItem[] };

      const { data: shortlistData } = await supabase.from('job_shortlist').select('job_id, status').in('job_id', activeJobIds);
      const { data: outreachData } = await supabase.from('outreach_messages').select('job_id, status').in('job_id', activeJobIds).eq('status', 'draft');
      const { data: applicationsData } = await supabase.from('job_applications').select('job_id, status').in('job_id', activeJobIds).eq('status', 'new');
      const { data: jobProjectLinks } = await supabase.from('jobs_projects' as any).select('job_id, project_id').in('job_id', activeJobIds);

      const today = startOfDay(new Date());
      const workItems: CriticalDateItem[] = [];
      const jobMap = new Map(activeJobs.map(j => [j.id, j]));

      const shortlistByJob = new Map<string, { pending: number; total: number }>();
      for (const s of (shortlistData ?? [])) { const e = shortlistByJob.get(s.job_id) || { pending: 0, total: 0 }; e.total++; if (s.status === 'pending') e.pending++; shortlistByJob.set(s.job_id, e); }
      for (const [jobId, counts] of shortlistByJob) {
        if (counts.pending > 0) { const job = jobMap.get(jobId); if (job) workItems.push({ id: `shortlist-${jobId}`, type: 'outreach_action', date: today, label: `Review shortlist for ${job.title}`, companyName: '', sowRef: null, overdue: false, daysUntil: 0 }); }
      }
      const outreachByJob = new Map<string, number>();
      for (const o of (outreachData ?? [])) outreachByJob.set(o.job_id, (outreachByJob.get(o.job_id) || 0) + 1);
      for (const [jobId] of outreachByJob) { const job = jobMap.get(jobId); if (job) workItems.push({ id: `outreach-pending-${jobId}`, type: 'outreach_action', date: today, label: `Outreach pending for ${job.title}`, companyName: '', sowRef: null, overdue: false, daysUntil: 0 }); }
      const appsByJob = new Map<string, number>();
      for (const a of (applicationsData ?? [])) appsByJob.set(a.job_id, (appsByJob.get(a.job_id) || 0) + 1);
      for (const [jobId, count] of appsByJob) { const job = jobMap.get(jobId); if (job) workItems.push({ id: `apps-${jobId}`, type: 'outreach_action', date: today, label: `${count} new application${count !== 1 ? 's' : ''} for ${job.title}`, companyName: '', sowRef: null, overdue: false, daysUntil: 0 }); }
      return { activeJobs, jobWorkItems: workItems, jobProjectLinks: jobProjectLinks ?? [] };
    },
    enabled: !!currentWorkspace?.id,
  });

  const jobWorkItems = jobsSummary?.jobWorkItems ?? [];
  const activeJobCount = (jobsSummary?.activeJobs ?? []).filter(j => j.status === 'active').length;
  const jobProjectLinksMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of (jobsSummary?.jobProjectLinks ?? [])) { const pid = (link as any).project_id; map.set(pid, (map.get(pid) || 0) + 1); }
    return map;
  }, [jobsSummary?.jobProjectLinks]);

  const isRecruitmentDeal = (deal: Deal) => deal.name.includes('Placement Fee');
  const activePlansExist = invoicePlans.some(p => p.status === 'active');
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const scheduledTodayCount = invoicePlans.filter(p => p.status === 'active' && p.next_run_date === todayStr).length;
  const blockedPlansCount = invoicePlans.filter(p => p.status === 'active' && !p.fixed_amount && !p.rate_per_day).length;

  const handleRunDueInvoices = async () => {
    if (!currentWorkspace?.id) return;
    setRunningDue(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-run-due-plans', { body: { workspace_id: currentWorkspace.id, mode: 'execute' } });
      if (error) throw error;
      const created = data?.invoices_created ?? data?.created_count ?? 0;
      const skipped = data?.invoices_skipped ?? data?.skipped_count ?? 0;
      toast.success(`${created} invoice(s) created, ${skipped} skipped`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-plans'] });
    } catch (e: any) { toast.error(e.message || 'Failed to run due invoices'); } finally { setRunningDue(false); }
  };

  const activeCount = engagements.filter((e) => e.stage === 'active').length;
  const activeDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const totalPipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedPipelineValue = activeDeals.reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  const next30Forecast = useMemo(() => {
    const cutoff = addDays(startOfDay(new Date()), 30);
    return activeDeals.filter((d) => d.expected_close_date && !isBefore(cutoff, startOfDay(new Date(d.expected_close_date)))).reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  }, [activeDeals]);

  const outreachWorkItems: CriticalDateItem[] = useMemo(() => {
    if (!outreachMetrics) return [];
    return [...outreachMetrics.upcomingActions, ...outreachMetrics.upcomingFollowUps].map(a => ({
      id: a.id, type: a.source === 'outreach_target' ? 'outreach_action' as const : 'call_followup' as const,
      date: a.date, label: `${a.label} — ${a.entityName}`, companyName: a.entityName, sowRef: null, overdue: a.overdue, daysUntil: a.daysUntil,
    }));
  }, [outreachMetrics]);

  const myWorkItems = useMemo(() => {
    const base = buildCriticalDates(sows, invoices, deals, 30);
    const all = [...base, ...outreachWorkItems, ...jobWorkItems];
    all.sort((a, b) => { if (a.overdue !== b.overdue) return a.overdue ? -1 : 1; return a.date.getTime() - b.date.getTime(); });
    return all.slice(0, 6);
  }, [sows, invoices, deals, outreachWorkItems, jobWorkItems]);

  const renewalItems = useMemo(() => buildCriticalDates(sows, [], [], 60), [sows]);
  const renewalCount = renewalItems.length;
  const overdueRenewalCount = renewalItems.filter((i) => i.overdue).length;
  const billing = useMemo(() => computeBillingSnapshot(invoices), [invoices]);

  const handleRefresh = async () => { setRefreshing(true); await refreshWorkspaces(); setTimeout(() => setRefreshing(false), 600); };
  const openSowDetail = (sow: Sow) => { setSelectedSow(sow); setSowSheetOpen(true); };
  const handleItemClick = (item: CriticalDateItem) => {
    if (item.sow) { if (item.sow.engagement_id) { navigate(`/projects/${item.sow.engagement_id}`); return; } openSowDetail(item.sow); return; }
    if (item.invoice?.engagement_id) navigate(`/projects/${item.invoice.engagement_id}`);
  };
  const handleMarkOverdue = async (inv: Invoice) => { try { await updateInvoice.mutateAsync({ id: inv.id, status: 'overdue' }); toast.success('Invoice marked as overdue'); } catch { toast.error('Failed to update invoice'); } };
  const handleMarkPaid = async (inv: Invoice) => { try { await updateInvoice.mutateAsync({ id: inv.id, status: 'paid', paid_date: new Date().toISOString().split('T')[0] }); toast.success('Invoice marked as paid'); } catch { toast.error('Failed to update invoice'); } };

  // ── Document expiry alerts ──
  const { data: expiringDocs = [] } = useQuery({
    queryKey: ['commercial_documents_expiring', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('commercial_documents' as any)
        .select('id, name, type, end_date, status, companies(id, name)')
        .eq('workspace_id', currentWorkspace.id)
        .not('end_date', 'is', null)
        .not('status', 'in', '("cancelled","expired")')
        .order('end_date');
      if (error) { console.error('doc expiry query:', error); return []; }
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // ── Alerts ──
  const alerts = useMemo(() => {
    const items: { label: string; color: string; onClick: () => void }[] = [];
    if (billing.overdueCount > 0) items.push({ label: `${billing.overdueCount} overdue invoice${billing.overdueCount !== 1 ? 's' : ''} · £${billing.overdueAmount.toLocaleString()}`, color: 'bg-destructive/10 text-destructive hover:bg-destructive/20', onClick: () => setBillingExpanded(true) });
    const renewalsDue30 = buildCriticalDates(sows, [], [], 30).length;
    if (renewalsDue30 > 0) items.push({ label: `${renewalsDue30} renewal${renewalsDue30 !== 1 ? 's' : ''} due within 30 days`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 hover:bg-amber-200', onClick: () => navigate('/documents') });

    // Document expiry alerts
    const today = startOfDay(new Date());
    for (const doc of expiringDocs as any[]) {
      if (!doc.end_date) continue;
      const endDate = startOfDay(new Date(doc.end_date));
      const days = differenceInDays(endDate, today);
      const companyLabel = doc.companies?.name ? ` (${doc.companies.name})` : '';
      if (days < 0) {
        items.push({ label: `🔴 ${doc.name} — EXPIRED${companyLabel}`, color: 'bg-destructive/10 text-destructive hover:bg-destructive/20', onClick: () => navigate('/documents') });
      } else if (days <= 30) {
        items.push({ label: `🔴 ${doc.name} expiring in ${days}d${companyLabel}`, color: 'bg-destructive/10 text-destructive hover:bg-destructive/20', onClick: () => navigate('/documents') });
      } else if (days <= 90) {
        items.push({ label: `🟡 ${doc.name} expiring in ${days}d${companyLabel}`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 hover:bg-amber-200', onClick: () => navigate('/documents') });
      }
    }

    return items;
  }, [billing, sows, expiringDocs]);

  // Auto-expand SOWs if they have entries
  useEffect(() => { if (sows.length > 0) setSowsExpanded(false); }, [sows.length]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F9FC' }}>
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Command Centre</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {currentWorkspace?.name ?? 'Workspace'} &middot; {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/insights" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              View Analytics →
            </Link>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={handleStartTour} data-jarvis-id="take-tour-button">
              <Compass className="w-3.5 h-3.5" /> Take the Tour
            </Button>
            <Button variant="outline" size="sm" className="gap-2" data-jarvis-id="pull-report"
              onClick={() => { setReportPreselect(undefined); setReportAutoDownload(false); setReportOpen(true); }}>
              <FileBarChart className="w-4 h-4" /> Pull Report
            </Button>
            <Button variant="outline" size="sm" className="gap-2" data-jarvis-id="refresh-command-centre"
              onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* ═══ 1. KPI ROW ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-jarvis-id="home-kpi-row" data-jarvis-section="stat-cards">
          <KPICard title="Active Projects" value={activeCount > 0 ? String(activeCount) : '—'}
            subtitle={activeCount > 0 ? `${activeCount} active${activeJobCount > 0 ? ` · ${activeJobCount} open role${activeJobCount !== 1 ? 's' : ''}` : ''}` : 'No projects yet'}
            icon={Briefcase} accentClass="bg-primary"
            onClick={() => {
              const section = document.querySelector('[data-jarvis-section="active-projects"]');
              if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
                const header = section.querySelector('h2');
                if (header) {
                  header.style.outline = '2px solid hsl(var(--primary))';
                  header.style.outlineOffset = '4px';
                  header.style.borderRadius = '4px';
                  header.style.transition = 'outline-color 0.6s ease-out';
                  setTimeout(() => { header.style.outlineColor = 'transparent'; }, 1500);
                  setTimeout(() => { header.style.outline = 'none'; }, 2100);
                }
              }
            }} />
          <KPICard title="Deal Pipeline" value={activeDeals.length > 0 ? `£${totalPipelineValue.toLocaleString()}` : '—'}
            subtitle={activeDeals.length > 0 ? `${activeDeals.length} deals · £${weightedPipelineValue.toLocaleString()} weighted` : 'No deals yet'}
            icon={TrendingUp} accentClass="bg-accent"
            onClick={() => navigate('/deals')} />
          <KPICard title="Outstanding Invoices" value={billing.outstandingCount > 0 ? `£${billing.outstandingAmount.toLocaleString()}` : '—'}
            subtitle={billing.outstandingCount > 0 ? `${billing.outstandingCount} unpaid` : 'No outstanding invoices'}
            icon={Receipt} accentClass="bg-warning"
            onClick={() => navigate('/accounts?filter=outstanding')} />
          {(() => {
            const docExpiringCount = (expiringDocs as any[]).filter((d: any) => {
              if (!d.end_date) return false;
              const days = differenceInDays(startOfDay(new Date(d.end_date)), startOfDay(new Date()));
              return days <= 90;
            }).length;
            const totalExpiring = renewalCount + docExpiringCount;
            const totalOverdue = overdueRenewalCount + (expiringDocs as any[]).filter((d: any) => d.end_date && differenceInDays(startOfDay(new Date(d.end_date)), startOfDay(new Date())) < 0).length;
            return (
              <KPICard title="Renewals & Key Dates" value={totalExpiring > 0 ? String(totalExpiring) : '—'}
                subtitle={totalOverdue > 0 ? `${totalOverdue} overdue` : totalExpiring > 0 ? `${totalExpiring} expiring` : 'Nothing upcoming'}
                icon={CalendarClock} accentClass="bg-success"
                onClick={() => navigate('/documents')} />
            );
          })()}
        </div>

        {/* ═══ 2. PIPELINE SNAPSHOT (hero) ═══ */}
        <section data-jarvis-section="pipeline-snapshot" data-jarvis-id="home-pipeline-snapshot">
          <SectionHeader title="Pipeline Snapshot" icon={TrendingUp} accentColor="bg-primary">
            <div className="text-xs text-muted-foreground">
              Total: £{totalPipelineValue.toLocaleString()} · Weighted: £{weightedPipelineValue.toLocaleString()} · 30d: £{next30Forecast.toLocaleString()}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setDealOpen(true)} data-jarvis-id="home-create-deal-button">
              <Plus className="w-3.5 h-3.5" /> Create Deal
            </Button>
          </SectionHeader>

          {dealsLoading ? (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : deals.length === 0 ? (
            <EmptyPanel title="No deals in pipeline" description="Track consulting and recruitment deals through your sales pipeline."
              icon={Target} ctas={[{ label: 'Create Deal', onClick: () => setDealOpen(true) }]} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-stretch -space-x-1 overflow-x-auto rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {DEAL_STAGES.map((stage, idx) => {
                  const stageDeals = deals.filter((d) => (d.stage || 'lead') === stage);
                  const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
                  const isActive = pipelineFilter === null || pipelineFilter === stage;
                  return <PipelineChevron key={stage} stage={stage} label={DEAL_STAGE_LABELS[stage]} count={stageDeals.length} total={stageTotal}
                    isFirst={idx === 0} isLast={idx === DEAL_STAGES.length - 1} isActive={isActive}
                    cascadeIndex={idx}
                    onClick={() => navigate(`/deals?stage=${stage}`, { state: { from: '/home' } })} />;
                })}
              </div>
              {(() => {
                const filteredDeals = pipelineFilter ? deals.filter(d => (d.stage || 'lead') === pipelineFilter) : deals;
                if (filteredDeals.length === 0) return <div className="rounded-lg border border-dashed border-border p-6 text-center"><p className="text-sm text-muted-foreground">No deals in {DEAL_STAGE_LABELS[pipelineFilter!]}</p></div>;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {filteredDeals.map(deal => (
                      <PipelineDealCard key={deal.id} deal={deal} isRecruitment={isRecruitmentDeal(deal)}
                        onAdvance={(ns) => { updateDeal.mutateAsync({ id: deal.id, stage: ns }); toast.success(`Moved to ${DEAL_STAGE_LABELS[ns]}`); }}
                        onCreateProject={deal.stage === 'won' && !deal.engagement_id ? () => { setConvertDeal(deal); setCreateOpen(true); } : undefined}
                        onViewProject={deal.stage === 'won' && deal.engagement_id ? () => navigate(`/projects/${deal.engagement_id}`) : undefined} />
                    ))}
                  </div>
                );
              })()}
              {pipelineFilter && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing <strong>{DEAL_STAGE_LABELS[pipelineFilter]}</strong> deals · <button className="underline hover:text-foreground" onClick={() => setPipelineFilter(null)}>Show all</button>
                </p>
              )}
            </div>
          )}
        </section>

        {/* ═══ METRICS BAR ═══ */}
        {(() => {
          const wonD = deals.filter(d => d.stage === 'won');
          const lostD = deals.filter(d => d.stage === 'lost');
          const wr = wonD.length + lostD.length > 0 ? Math.round((wonD.length / (wonD.length + lostD.length)) * 100) : null;
          const avgDeal = activeDeals.length > 0 ? Math.round(activeDeals.reduce((s, d) => s + d.value, 0) / activeDeals.length) : null;
          const pipelineHealth = activeDeals.length > 0 ? (activeDeals.length >= 5 ? 'Strong' : activeDeals.length >= 2 ? 'Building' : 'Thin') : null;
          return (deals.length > 0 || billing.overdueCount > 0) ? (
            <div className="flex flex-wrap items-center gap-6 px-4 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground" data-jarvis-id="home-metrics-bar">
              <Link to="/insights" className="hover:text-foreground transition-colors cursor-pointer">
                Win Rate: <span className="font-semibold text-foreground">{wr !== null ? `${wr}%` : '—'}</span>
              </Link>
              <span>|</span>
              <span>Avg Deal Size: <span className="font-semibold text-foreground">{avgDeal !== null ? `£${avgDeal.toLocaleString()}` : '—'}</span></span>
              <span>|</span>
              <span>Pipeline Health: <span className="font-semibold text-foreground">{pipelineHealth ?? '—'}</span></span>
              <span>|</span>
              <Link to="/insights" className="hover:text-foreground transition-colors cursor-pointer">
                Overdue Invoices: <span className={`font-semibold ${billing.overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}>£{billing.overdueAmount.toLocaleString()}</span>
              </Link>
            </div>
          ) : null;
        })()}

        {/* ═══ 3. MY WORK + DIARY (50/50) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div data-jarvis-section="my-work">
            <SectionHeader title="My Work" icon={CheckSquare} accentColor="bg-[hsl(262,80%,55%)]" jarvisId="home-my-work">
              {scheduledTodayCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1"><Zap className="w-3 h-3" />{scheduledTodayCount} invoice{scheduledTodayCount !== 1 ? 's' : ''} scheduled today</Badge>
              )}
              <Badge variant="secondary" className="text-xs">{myWorkItems.length} items</Badge>
            </SectionHeader>
            {myWorkItems.length === 0 ? (
              <EmptyPanel title="No tasks or critical dates" description="Upcoming renewals, invoice due dates and overdue items will appear here."
                icon={Clock} ctas={[{ label: 'Add SOW', onClick: () => setSowOpen(true) }, { label: 'Create Invoice', onClick: () => setInvoiceOpen(true), variant: 'outline' }]} />
            ) : (
              <Card className="divide-y divide-border/50 border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                {myWorkItems.map((item) => <CriticalDateRow key={item.id} item={item} onClick={() => handleItemClick(item)} />)}
              </Card>
            )}
          </div>
          <div data-jarvis-section="diary">
            <SectionHeader title="Diary" icon={CalendarClock} accentColor="bg-primary" jarvisId="home-diary">
              <Badge variant="secondary" className="text-xs">Next 7 days</Badge>
            </SectionHeader>
            <DiaryEventsSection workspaceId={currentWorkspace?.id} />
          </div>
        </div>

        {/* ═══ 4. ACTIVE PROJECTS ═══ */}
        <section data-jarvis-id="home-active-projects" data-jarvis-section="active-projects">
          <SectionHeader title="Active Projects" icon={Briefcase} accentColor="bg-green-500">
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)} data-jarvis-id="home-create-project-button">
              <Plus className="w-3.5 h-3.5" /> Create Project
            </Button>
          </SectionHeader>
          {engLoading ? (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : engagements.length === 0 ? (
            <EmptyPanel title="No active projects" description="Create a project to track placements, engagements and deliverables."
              icon={LayoutGrid} ctas={[{ label: 'Create Project', onClick: () => setCreateOpen(true) }, { label: 'Add Company', to: '/companies', variant: 'outline' }]} />
          ) : (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jobs</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Forecast</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagements.map((eng, i) => {
                      const roleCount = jobProjectLinksMap.get(eng.id) || 0;
                      const healthColor = eng.health === 'green' ? 'bg-green-500' : eng.health === 'amber' ? 'bg-amber-500' : eng.health === 'red' ? 'bg-red-500' : 'bg-muted';
                      return (
                        <tr key={eng.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                          onClick={() => navigate(`/projects/${eng.id}`, { state: { from: '/home' } })}>
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium text-foreground">{eng.name}</span>
                              <div className={`mt-1 h-1 w-16 rounded-full ${healthColor}`} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {eng.companies?.name ? <span className="text-muted-foreground">{eng.companies.name}</span> : <span className="text-muted-foreground italic">Independent</span>}
                          </td>
                          <td className="px-4 py-3"><Badge variant="secondary" className="text-xs capitalize">{eng.engagement_type.replace('_', ' ')}</Badge></td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{STAGE_LABELS[eng.stage] ?? eng.stage}</Badge></td>
                          <td className="px-4 py-3"><span className={`inline-block w-2.5 h-2.5 rounded-full ${healthColor}`} title={eng.health ?? 'unknown'} /></td>
                          <td className="px-4 py-3">
                            {roleCount > 0 ? (
                              <Badge className="text-[10px] gap-0.5 font-normal bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-0">
                                <Users className="w-2.5 h-2.5" />{roleCount} role{roleCount !== 1 ? 's' : ''}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{eng.forecast_value > 0 ? `${eng.currency} ${eng.forecast_value.toLocaleString()}` : '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(eng.updated_at), 'dd MMM yyyy')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* ═══ 5. ALERTS STRIP ═══ */}
        {alerts.length > 0 && (
          <section data-jarvis-id="home-alerts-strip" data-jarvis-section="alerts-strip">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <div className="flex flex-wrap items-center gap-2">
                {alerts.map((a, i) => (
                  <button key={i} onClick={a.onClick}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${a.color}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══ 6. OUTREACH STATS ROW ═══ */}
        {outreachMetrics && outreachMetrics.totalTargets > 0 && (
          <section data-jarvis-section="outreach-stats">
            <SectionHeader title="Outreach" icon={Send} accentColor="bg-primary" />
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
                <Card key={m.label} className="p-3 text-center border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ═══ 7. BILLING SNAPSHOT (collapsible) ═══ */}
        <section data-jarvis-section="billing-snapshot">
          <SectionHeader title="Billing Snapshot" icon={Receipt} accentColor="bg-amber-500" jarvisId="home-billing-snapshot">
            {activePlansExist && <Badge variant="secondary" className="text-xs gap-1"><Zap className="w-3 h-3" />Auto-billing</Badge>}
            {(isAdmin || isManager) && activePlansExist && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRunDueInvoices} disabled={runningDue}>
                {runningDue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Run due invoices
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setInvoiceOpen(true)} data-jarvis-id="home-create-invoice-button">
              <Plus className="w-3.5 h-3.5" /> Create Invoice
            </Button>
          </SectionHeader>

          {invLoading ? (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
          ) : invoices.length === 0 ? (
            <EmptyPanel title="No invoices yet" description="Track outstanding invoices, payments and billing milestones here."
              icon={Receipt} ctas={[{ label: 'Create Invoice', onClick: () => setInvoiceOpen(true) }]} />
          ) : (
            <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              {/* Collapsed summary — always visible */}
              <button onClick={() => setBillingExpanded(!billingExpanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Outstanding</p>
                    <p className="text-xl font-bold text-foreground">£{billing.outstandingAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue</p>
                    <p className={`text-xl font-bold ${billing.overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}>£{billing.overdueAmount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {billingExpanded ? 'Hide' : 'Show'} Billing Detail
                  <ChevronDown className={`w-4 h-4 transition-transform ${billingExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Expanded table */}
              {billingExpanded && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv, i) => {
                        const today = startOfDay(new Date());
                        const isComputedOverdue = inv.status === 'sent' && inv.due_date && isBefore(startOfDay(new Date(inv.due_date)), today) && !inv.paid_date;
                        const displayStatus = isComputedOverdue && inv.status !== 'overdue' ? 'overdue' : inv.status;
                        return (
                          <tr key={inv.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                            <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{inv.companies?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              <Badge className={`text-xs capitalize ${STATUS_BADGE_STYLES[displayStatus] ?? STATUS_BADGE_STYLES.draft}`}>{displayStatus}</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{inv.currency} {inv.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {isComputedOverdue && inv.status !== 'overdue' && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleMarkOverdue(inv)}>Mark Overdue</Button>}
                                {inv.status !== 'paid' && inv.status !== 'void' && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleMarkPaid(inv)}>Mark Paid</Button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </section>

        {/* SOWs & Contracts section removed — documents now live in /documents hub */}

        {/* ═══ MODALS ═══ */}
        <CreateEngagementModal open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setConvertDeal(null); }}
          prefillCompanyId={convertDeal?.company_id} prefillDealId={convertDeal?.id}
          prefillName={convertDeal ? `${convertDeal.name} — Delivery` : undefined} prefillValue={convertDeal?.value} />
        <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
        <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
        <CreateDealModal open={dealOpen} onOpenChange={setDealOpen} />
        <SowDetailSheet sow={selectedSow} open={sowSheetOpen} onOpenChange={setSowSheetOpen} />
        <ReportBuilderPanel open={reportOpen} onOpenChange={setReportOpen} preselectedType={reportPreselect} autoDownload={reportAutoDownload} />

        {/* Tour Player */}
        <GuidedTourPlayer tour={jarvisNav.tourState} onPause={jarvisNav.pauseTour} onResume={jarvisNav.resumeTour}
          onSkip={jarvisNav.skipTourStep} onStop={jarvisNav.stopTour} />
      </div>
    </div>
  );
};

export default HomeCommandCenter;
