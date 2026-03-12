import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { useSows, type Sow } from '@/hooks/use-sows';
import { useInvoices, type Invoice } from '@/hooks/use-invoices';
import { useDeals, useUpdateDeal, type Deal, DEAL_STAGES, DEAL_STAGE_LABELS } from '@/hooks/use-deals';
import { useOutreachMetrics } from '@/hooks/use-outreach-metrics';
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
  AlertTriangle, ChevronRight, DollarSign, Target, Phone,
  Users, Zap, Video, CheckSquare, Inbox, Send, FileBarChart, Compass,
  ArrowUpRight,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, differenceInDays, addDays, isBefore, startOfDay } from 'date-fns';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

/* ─── Dark theme constants ─── */
const DARK = {
  page: '#0F1117',
  card: '#1A1F2E',
  border: '#2D3748',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  hover: '#252B3B',
};

/* ─── Types ─── */
interface WorkItem {
  id: string;
  type: 'deal' | 'job' | 'outreach' | 'invoice_overdue';
  date: Date;
  label: string;
  overdue: boolean;
  daysUntil: number;
  onClick: () => void;
  icon: React.ElementType;
}

/* ─── Section Card Wrapper ─── */
function SectionCard({
  title,
  subtitle,
  icon: Icon,
  borderColor,
  jarvisId,
  jarvisSection,
  headerRight,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  borderColor: string;
  jarvisId?: string;
  jarvisSection?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ background: DARK.card, border: `1px solid ${DARK.border}`, borderLeft: `4px solid ${borderColor}` }}
      data-jarvis-id={jarvisId}
      data-jarvis-section={jarvisSection}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4" style={{ color: DARK.textSecondary }} />
          <h2 className="text-sm font-semibold" style={{ color: DARK.text }}>{title}</h2>
          {subtitle && <span className="text-xs" style={{ color: DARK.textSecondary }}>{subtitle}</span>}
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </div>
      <div className="px-6 pb-5">
        {children}
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ title, value, subtitle, icon: Icon, accentColor, onClick }: {
  title: string; value: string; subtitle: string; icon: React.ElementType; accentColor: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl text-left transition-all duration-150 group w-full ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
    >
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: accentColor }} />
      <div className="p-5 flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}20` }}>
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: DARK.textSecondary }}>{title}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color: DARK.text }}>{value}</p>
          <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>{subtitle}</p>
        </div>
        {onClick && (
          <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-3 right-3" style={{ color: DARK.textSecondary }} />
        )}
      </div>
    </button>
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
    el.style.filter = 'brightness(0.6)';
    el.style.transition = 'filter 0.25s ease, transform 0.25s ease';
    const t1 = setTimeout(() => {
      el.style.filter = 'brightness(1.4) saturate(1.3)';
      el.style.transform = 'scale(1.04)';
      const countEl = el.querySelector('[data-chevron-count]') as HTMLElement;
      if (countEl) { countEl.style.transition = 'transform 0.2s ease'; countEl.style.transform = 'scale(1.3)'; setTimeout(() => { countEl.style.transform = 'scale(1)'; }, 200); }
    }, cascadeIndex * 180);
    const t2 = setTimeout(() => {
      el.style.filter = count > 0 ? 'brightness(1.05)' : 'brightness(0.85)';
      el.style.transform = 'scale(1)';
      el.style.opacity = count > 0 ? '1' : '0.7';
    }, cascadeIndex * 180 + 400);
    const t3 = setTimeout(() => { sessionStorage.setItem('pipeline_cascade_done', 'true'); }, 6 * 180 + 500);
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

/* ─── Deal Card ─── */
function PipelineDealCard({ deal, onAdvance, onCreateProject, onViewProject, isRecruitment }: {
  deal: Deal; onAdvance?: (nextStage: string) => void; onCreateProject?: () => void; onViewProject?: () => void; isRecruitment: boolean;
}) {
  const today = startOfDay(new Date());
  const createdDate = startOfDay(new Date(deal.updated_at));
  const daysInStage = Math.max(0, differenceInDays(today, createdDate));
  const stageIdx = DEAL_STAGES.indexOf(deal.stage as any);
  const nextStage = stageIdx >= 0 && stageIdx < DEAL_STAGES.length - 2 ? DEAL_STAGES[stageIdx + 1] : null;

  return (
    <div className="rounded-lg p-4 transition-all hover:brightness-110" style={{ background: DARK.hover, border: `1px solid ${DARK.border}` }}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold truncate flex-1" style={{ color: DARK.text }}>{deal.name}</p>
        {isRecruitment && (
          <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">R</span>
        )}
        <Badge className="text-[10px]" style={{ background: CHEVRON_COLORS[deal.stage] ?? '#6B7280', color: '#fff', border: 'none' }}>
          {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
        </Badge>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: DARK.textSecondary }}>
        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{deal.companies?.name ?? '—'}</span>
        <span className="font-medium" style={{ color: DARK.text }}>£{deal.value.toLocaleString()}</span>
        {deal.expected_close_date && <span>{format(new Date(deal.expected_close_date), 'dd MMM')}</span>}
        <span className="ml-auto tabular-nums">{daysInStage}d in stage</span>
      </div>
      <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: `1px solid ${DARK.border}` }}>
        {nextStage && deal.stage !== 'won' && deal.stage !== 'lost' && onAdvance && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => onAdvance(nextStage)}>
            → {DEAL_STAGE_LABELS[nextStage]}
          </Button>
        )}
        {deal.stage === 'won' && !deal.engagement_id && onCreateProject && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-green-400 hover:bg-green-500/10 gap-1" onClick={onCreateProject}>
            <Briefcase className="w-3 h-3" /> Create Project
          </Button>
        )}
        {deal.stage === 'won' && deal.engagement_id && onViewProject && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={onViewProject}>
            <ArrowRight className="w-3 h-3" /> View Project
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline', active: 'Active', on_hold: 'On Hold', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
};

function computeBillingSnapshot(invoices: Invoice[]) {
  const today = startOfDay(new Date());
  let outstandingAmount = 0, outstandingCount = 0, overdueAmount = 0, overdueCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue;
    outstandingAmount += inv.amount; outstandingCount++;
    if (inv.due_date) {
      const d = startOfDay(new Date(inv.due_date));
      if ((isBefore(d, today) && !inv.paid_date) || inv.status === 'overdue') { overdueAmount += inv.amount; overdueCount++; }
    }
  }
  return { outstandingAmount, outstandingCount, overdueAmount, overdueCount };
}

function buildCriticalDates(sows: Sow[], windowDays: number) {
  const today = startOfDay(new Date());
  const items: { id: string; overdue: boolean }[] = [];
  for (const sow of sows) {
    if (sow.status === 'expired') continue;
    if (sow.renewal_date) { const d = startOfDay(new Date(sow.renewal_date)); const diff = differenceInDays(d, today); if (diff <= windowDays) items.push({ id: sow.id, overdue: isBefore(d, today) }); }
    if (sow.end_date) { const d = startOfDay(new Date(sow.end_date)); const diff = differenceInDays(d, today); if (diff <= windowDays) items.push({ id: sow.id, overdue: isBefore(d, today) }); }
  }
  return items;
}

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
      if (error) return [];
      return data || [];
    },
    enabled: !!workspaceId, refetchInterval: 30000,
  });
  const EVENT_ICONS: Record<string, React.ElementType> = { call: Phone, meeting: Video, task: CheckSquare };

  if (diaryEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${DARK.border}` }}>
          <CalendarClock className="w-6 h-6" style={{ color: DARK.textSecondary }} />
        </div>
        <p className="text-sm font-medium" style={{ color: DARK.text }}>No events this week</p>
        <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>Booked calls, meetings and tasks will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y" style={{ borderColor: DARK.border }}>
      {diaryEvents.map((evt: any) => {
        const Icon = EVENT_ICONS[evt.event_type] || CalendarClock;
        const startDate = new Date(evt.start_time);
        return (
          <div key={evt.id} className="flex items-center gap-3 py-3 transition-colors rounded-lg cursor-pointer hover:brightness-110">
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6366F120' }}>
              <Icon className="w-4 h-4" style={{ color: '#818CF8' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: DARK.text }}>{evt.title}</p>
              <p className="text-xs" style={{ color: DARK.textSecondary }}>
                {format(startDate, 'EEEE')} · {format(startDate, 'HH:mm')}–{format(new Date(evt.end_time), 'HH:mm')}
              </p>
            </div>
            <span className="text-xs" style={{ color: DARK.textSecondary }}>{format(startDate, 'dd MMM')}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tour Steps ─── */
const COMMAND_CENTRE_TOUR: GuidedTourStep[] = [
  { speak: "Welcome to your Command Centre. This is the heartbeat of your business.", delay: 2000 },
  { highlight: '[data-jarvis-section="stat-cards"]', speak: "These four cards give you your headline numbers." },
  { highlight: '[data-jarvis-section="pipeline"]', speak: "Your deal pipeline — every deal by stage. Click any chevron to drill in." },
  { highlight: '[data-jarvis-section="my-work"]', speak: "My Work shows what needs your attention today." },
  { highlight: '[data-jarvis-section="diary"]', speak: "Your diary shows calls and meetings for the next seven days." },
  { highlight: '[data-jarvis-section="active-projects"]', speak: "Active Projects shows all your live engagements." },
  { highlight: '[data-jarvis-section="outreach"]', speak: "Outreach shows campaign stats and response rates." },
  { speak: "That's your Command Centre. Ask me to take you anywhere.", delay: 2000 },
];

/* ═══════════════════════════════════════════════════════════════ */
/* ─── Main Page ─── */
/* ═══════════════════════════════════════════════════════════════ */
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

  const { data: engagements = [], isLoading: engLoading } = useEngagements(currentWorkspace?.id);
  const { data: sows = [] } = useSows(currentWorkspace?.id);
  const { data: invoices = [], isLoading: invLoading } = useInvoices(currentWorkspace?.id);
  const { data: deals = [], isLoading: dealsLoading } = useDeals(currentWorkspace?.id);
  const { data: outreachMetrics } = useOutreachMetrics(currentWorkspace?.id);
  const { data: invoicePlans = [] } = useInvoicePlans(currentWorkspace?.id);
  const queryClient = useQueryClient();
  const updateDeal = useUpdateDeal();
  const jarvisNav = useJarvisNavigation();

  const handleStartTour = useCallback(async () => {
    await jarvisNav.runGuidedTour(COMMAND_CENTRE_TOUR);
    toast.success('Tour complete.');
  }, [jarvisNav]);

  // Jobs data
  const { data: jobsSummary } = useQuery({
    queryKey: ['jobs_command_centre', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { activeJobs: [], jobWorkItems: [] as WorkItem[], jobProjectLinks: [] };
      const { data: jobs } = await supabase.from('jobs').select('id, title, status, company_id').eq('workspace_id', currentWorkspace.id).in('status', ['active', 'draft']);
      const activeJobs = jobs ?? [];
      const activeJobIds = activeJobs.filter(j => j.status === 'active').map(j => j.id);
      if (activeJobIds.length === 0) return { activeJobs, jobWorkItems: [] as WorkItem[], jobProjectLinks: [] };
      const { data: shortlistData } = await supabase.from('job_shortlist').select('job_id, status').in('job_id', activeJobIds);
      const { data: applicationsData } = await supabase.from('job_applications').select('job_id, status').in('job_id', activeJobIds).eq('status', 'new');
      const { data: jobProjectLinks } = await supabase.from('jobs_projects' as any).select('job_id, project_id').in('job_id', activeJobIds);

      const today = startOfDay(new Date());
      const workItems: WorkItem[] = [];
      const jobMap = new Map(activeJobs.map(j => [j.id, j]));
      const shortlistByJob = new Map<string, number>();
      for (const s of (shortlistData ?? [])) { if (s.status === 'pending') shortlistByJob.set(s.job_id, (shortlistByJob.get(s.job_id) || 0) + 1); }
      for (const [jobId, count] of shortlistByJob) { const job = jobMap.get(jobId); if (job) workItems.push({ id: `shortlist-${jobId}`, type: 'job', date: today, label: `Review ${count} shortlisted for ${job.title}`, overdue: false, daysUntil: 0, onClick: () => {}, icon: Users }); }
      const appsByJob = new Map<string, number>();
      for (const a of (applicationsData ?? [])) appsByJob.set(a.job_id, (appsByJob.get(a.job_id) || 0) + 1);
      for (const [jobId, count] of appsByJob) { const job = jobMap.get(jobId); if (job) workItems.push({ id: `apps-${jobId}`, type: 'job', date: today, label: `${count} new application${count !== 1 ? 's' : ''} for ${job.title}`, overdue: false, daysUntil: 0, onClick: () => {}, icon: Inbox }); }
      return { activeJobs, jobWorkItems: workItems, jobProjectLinks: jobProjectLinks ?? [] };
    },
    enabled: !!currentWorkspace?.id,
  });

  const activeJobCount = (jobsSummary?.activeJobs ?? []).filter(j => j.status === 'active').length;
  const jobProjectLinksMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of (jobsSummary?.jobProjectLinks ?? [])) { const pid = (link as any).project_id; map.set(pid, (map.get(pid) || 0) + 1); }
    return map;
  }, [jobsSummary?.jobProjectLinks]);

  const isRecruitmentDeal = (deal: Deal) => deal.name?.includes('Placement Fee') || deal.name?.includes('Recruitment');

  // Document expiry
  const { data: expiringDocs = [] } = useQuery({
    queryKey: ['commercial_documents_expiring', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase.from('commercial_documents' as any).select('id, name, type, end_date, status, companies(id, name)')
        .eq('workspace_id', currentWorkspace.id).not('end_date', 'is', null).not('status', 'in', '("cancelled","expired")').order('end_date');
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // ── Computed values ──
  const activeCount = engagements.filter((e) => e.stage === 'active').length;
  const activeDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const totalPipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedPipelineValue = activeDeals.reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  const next30Forecast = useMemo(() => {
    const cutoff = addDays(startOfDay(new Date()), 30);
    return activeDeals.filter((d) => d.expected_close_date && !isBefore(cutoff, startOfDay(new Date(d.expected_close_date)))).reduce((s, d) => s + Math.round(d.value * d.probability / 100), 0);
  }, [activeDeals]);
  const billing = useMemo(() => computeBillingSnapshot(invoices), [invoices]);
  const renewalItems = useMemo(() => buildCriticalDates(sows, 60), [sows]);
  const renewalCount = renewalItems.length;
  const overdueRenewalCount = renewalItems.filter((i) => i.overdue).length;

  // My Work items
  const myWorkItems = useMemo(() => {
    const items: WorkItem[] = [];
    const today = startOfDay(new Date());

    // Overdue invoices
    for (const inv of invoices) {
      if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue;
      if (inv.due_date && isBefore(startOfDay(new Date(inv.due_date)), today) && !inv.paid_date) {
        items.push({ id: `inv-${inv.id}`, type: 'invoice_overdue', date: new Date(inv.due_date), label: `⚠️ Invoice ${inv.invoice_number || '#' + inv.id.slice(0, 6)} overdue — ${inv.companies?.name ?? 'Unknown'}`, overdue: true, daysUntil: differenceInDays(new Date(inv.due_date), today), onClick: () => {}, icon: AlertTriangle });
      }
    }
    // Deals closing in 7 days
    for (const deal of deals) {
      if (deal.stage === 'won' || deal.stage === 'lost' || !deal.expected_close_date) continue;
      const d = startOfDay(new Date(deal.expected_close_date));
      const diff = differenceInDays(d, today);
      if (diff >= 0 && diff <= 7) {
        items.push({ id: `deal-${deal.id}`, type: 'deal', date: d, label: `💼 ${deal.name} closing in ${diff} day${diff !== 1 ? 's' : ''}`, overdue: false, daysUntil: diff, onClick: () => {}, icon: Target });
      }
    }
    // Job work items
    items.push(...(jobsSummary?.jobWorkItems ?? []));

    items.sort((a, b) => { if (a.overdue !== b.overdue) return a.overdue ? -1 : 1; return a.date.getTime() - b.date.getTime(); });
    return items.slice(0, 8);
  }, [invoices, deals, jobsSummary?.jobWorkItems]);

  const handleRefresh = async () => { sessionStorage.removeItem('pipeline_cascade_done'); setRefreshing(true); await refreshWorkspaces(); setTimeout(() => setRefreshing(false), 600); };

  return (
    <div className="min-h-screen" style={{ background: DARK.page }}>
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-5">

        {/* ═══ ROW 1 — HEADER ═══ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: DARK.text }}>Command Centre</h1>
            <p className="text-sm mt-0.5" style={{ color: DARK.textSecondary }}>
              {currentWorkspace?.name ?? 'Workspace'} &middot; {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/insights" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">View Analytics →</Link>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" style={{ color: DARK.textSecondary }} onClick={handleStartTour}>
              <Compass className="w-3.5 h-3.5" /> Tour
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-[#2D3748] text-slate-300 hover:bg-[#252B3B]"
              onClick={() => { setReportPreselect(undefined); setReportAutoDownload(false); setReportOpen(true); }}>
              <FileBarChart className="w-4 h-4" /> Pull Report
            </Button>
            <Button variant="outline" size="sm" className="gap-2 border-[#2D3748] text-slate-300 hover:bg-[#252B3B]"
              onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* ═══ ROW 2 — KPI CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-jarvis-section="stat-cards">
          <KPICard title="Active Projects" value={activeCount > 0 ? String(activeCount) : '—'}
            subtitle={activeCount > 0 ? `${activeCount} active${activeJobCount > 0 ? ` · ${activeJobCount} open roles` : ''}` : 'No projects yet'}
            icon={Briefcase} accentColor="#3B82F6"
            onClick={() => { const s = document.querySelector('[data-jarvis-section="active-projects"]'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }} />
          <KPICard title="Deal Pipeline" value={activeDeals.length > 0 ? `£${totalPipelineValue.toLocaleString()}` : '—'}
            subtitle={activeDeals.length > 0 ? `${activeDeals.length} deals · £${weightedPipelineValue.toLocaleString()} weighted` : 'No deals yet'}
            icon={TrendingUp} accentColor="#8B5CF6"
            onClick={() => navigate('/deals')} />
          <KPICard title="Outstanding Invoices" value={billing.outstandingCount > 0 ? `£${billing.outstandingAmount.toLocaleString()}` : '—'}
            subtitle={billing.overdueCount > 0 ? `${billing.overdueCount} overdue · £${billing.overdueAmount.toLocaleString()}` : billing.outstandingCount > 0 ? `${billing.outstandingCount} unpaid` : 'No outstanding invoices'}
            icon={Receipt} accentColor="#F59E0B"
            onClick={() => navigate('/accounts?filter=outstanding')} />
          {(() => {
            const docExpiringCount = (expiringDocs as any[]).filter((d: any) => d.end_date && differenceInDays(startOfDay(new Date(d.end_date)), startOfDay(new Date())) <= 90).length;
            const totalExpiring = renewalCount + docExpiringCount;
            const totalOverdue = overdueRenewalCount + (expiringDocs as any[]).filter((d: any) => d.end_date && differenceInDays(startOfDay(new Date(d.end_date)), startOfDay(new Date())) < 0).length;
            return (
              <KPICard title="Renewals & Key Dates" value={totalExpiring > 0 ? String(totalExpiring) : '—'}
                subtitle={totalOverdue > 0 ? `${totalOverdue} overdue` : totalExpiring > 0 ? `${totalExpiring} expiring` : 'Nothing upcoming'}
                icon={CalendarClock} accentColor="#22C55E"
                onClick={() => navigate('/documents')} />
            );
          })()}
        </div>

        {/* ═══ ROW 3 — DEAL PIPELINE ═══ */}
        <SectionCard title="Deal Pipeline" subtitle={activeDeals.length > 0 ? `£${totalPipelineValue.toLocaleString()} total · £${weightedPipelineValue.toLocaleString()} weighted` : undefined}
          icon={TrendingUp} borderColor="#3B82F6" jarvisSection="pipeline"
          headerRight={
            <div className="flex items-center gap-2">
              <Link to="/deals" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View All Deals →</Link>
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setDealOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Create Deal
              </Button>
            </div>
          }>
          {dealsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: DARK.textSecondary }} /></div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DARK.border }}>
                <Target className="w-6 h-6" style={{ color: DARK.textSecondary }} />
              </div>
              <p className="text-sm font-medium" style={{ color: DARK.text }}>No deals in pipeline</p>
              <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>Track consulting and recruitment deals through your sales pipeline.</p>
              <Button size="sm" className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setDealOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Create Deal
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-stretch -space-x-1 overflow-x-auto rounded-xl" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {DEAL_STAGES.map((stage, idx) => {
                  const stageDeals = deals.filter((d) => (d.stage || 'lead') === stage);
                  const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
                  const isActive = pipelineFilter === null || pipelineFilter === stage;
                  return <PipelineChevron key={stage} stage={stage} label={DEAL_STAGE_LABELS[stage]} count={stageDeals.length} total={stageTotal}
                    isFirst={idx === 0} isLast={idx === DEAL_STAGES.length - 1} isActive={isActive}
                    cascadeIndex={idx}
                    onClick={() => setPipelineFilter(pipelineFilter === stage ? null : stage)} />;
                })}
              </div>
              {(() => {
                const filteredDeals = pipelineFilter ? deals.filter(d => (d.stage || 'lead') === pipelineFilter) : deals;
                if (filteredDeals.length === 0) return (
                  <div className="rounded-lg p-6 text-center" style={{ border: `1px dashed ${DARK.border}` }}>
                    <p className="text-sm" style={{ color: DARK.textSecondary }}>No deals in {DEAL_STAGE_LABELS[pipelineFilter!]}</p>
                  </div>
                );
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {filteredDeals.map(deal => (
                      <PipelineDealCard key={deal.id} deal={deal} isRecruitment={isRecruitmentDeal(deal)}
                        onAdvance={(ns) => { updateDeal.mutateAsync({ id: deal.id, stage: ns }); toast.success(`${deal.name} advanced to ${DEAL_STAGE_LABELS[ns]}`); }}
                        onCreateProject={deal.stage === 'won' && !deal.engagement_id ? () => { setConvertDeal(deal); setCreateOpen(true); } : undefined}
                        onViewProject={deal.stage === 'won' && deal.engagement_id ? () => navigate(`/projects/${deal.engagement_id}`) : undefined} />
                    ))}
                  </div>
                );
              })()}
              {pipelineFilter && (
                <p className="text-xs text-center" style={{ color: DARK.textSecondary }}>
                  Showing <strong style={{ color: DARK.text }}>{DEAL_STAGE_LABELS[pipelineFilter]}</strong> deals · <button className="underline hover:text-white" onClick={() => setPipelineFilter(null)}>Show all</button>
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* ═══ ROW 4 — MY WORK + DIARY (55/45) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5">
          {/* My Work */}
          <SectionCard title="My Work" subtitle={`${myWorkItems.length} items`} icon={CheckSquare} borderColor="#F59E0B"
            jarvisSection="my-work" jarvisId="home-my-work">
            {myWorkItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#22C55E20' }}>
                  <CheckSquare className="w-7 h-7" style={{ color: '#22C55E' }} />
                </div>
                <p className="text-base font-semibold" style={{ color: '#22C55E' }}>✓ All clear</p>
                <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>Nothing needs your attention right now</p>
              </div>
            ) : (
              <div className="space-y-0">
                {myWorkItems.map((item) => (
                  <button key={item.id} onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-colors group"
                    style={{ borderBottom: `1px solid ${DARK.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = DARK.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: item.overdue ? '#EF444420' : '#3B82F620' }}>
                      <item.icon className="w-4 h-4" style={{ color: item.overdue ? '#EF4444' : '#60A5FA' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: DARK.text }}>{item.label}</p>
                      <p className="text-xs" style={{ color: DARK.textSecondary }}>
                        {item.overdue ? `${Math.abs(item.daysUntil)}d overdue` : item.daysUntil === 0 ? 'Today' : `in ${item.daysUntil}d`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: DARK.textSecondary }} />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* This Week's Diary */}
          <SectionCard title="This Week" subtitle="Next 7 days" icon={CalendarClock} borderColor="#6366F1"
            jarvisSection="diary" jarvisId="home-diary">
            <DiaryEventsSection workspaceId={currentWorkspace?.id} />
          </SectionCard>
        </div>

        {/* ═══ ROW 5 — ACTIVE PROJECTS ═══ */}
        <SectionCard title="Active Projects" icon={Briefcase} borderColor="#22C55E"
          jarvisSection="active-projects" jarvisId="home-active-projects"
          headerRight={
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Create Project
            </Button>
          }>
          {engLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" style={{ color: DARK.textSecondary }} /></div>
          ) : engagements.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DARK.border }}>
                <LayoutGrid className="w-6 h-6" style={{ color: DARK.textSecondary }} />
              </div>
              <p className="text-sm font-medium" style={{ color: DARK.text }}>No active projects</p>
              <p className="text-xs mt-1" style={{ color: DARK.textSecondary }}>Create a project to track placements, engagements and deliverables.</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500 text-white" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Create Project
                </Button>
                <Button size="sm" variant="outline" className="border-[#2D3748] text-slate-300 hover:bg-[#252B3B]" asChild>
                  <Link to="/companies"><Building2 className="w-3.5 h-3.5 mr-1" /> Add Company</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${DARK.border}` }}>
                    {['Name', 'Company', 'Type', 'Stage', 'Health', 'Jobs', 'Forecast', 'Updated'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: DARK.textSecondary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {engagements.map((eng) => {
                    const roleCount = jobProjectLinksMap.get(eng.id) || 0;
                    const healthColor = eng.health === 'green' ? '#22C55E' : eng.health === 'amber' ? '#F59E0B' : eng.health === 'red' ? '#EF4444' : DARK.border;
                    return (
                      <tr key={eng.id} className="transition-colors cursor-pointer"
                        style={{ borderBottom: `1px solid ${DARK.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.background = DARK.hover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => navigate(`/projects/${eng.id}`, { state: { from: '/home' } })}>
                        <td className="px-4 py-3">
                          <span className="font-medium" style={{ color: DARK.text }}>{eng.name}</span>
                        </td>
                        <td className="px-4 py-3" style={{ color: DARK.textSecondary }}>
                          {eng.companies?.name || <span className="italic">Independent</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize"
                            style={{ background: `${DARK.border}`, color: DARK.text }}>
                            {eng.engagement_type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{ border: `1px solid ${DARK.border}`, color: DARK.text }}>
                            {STAGE_LABELS[eng.stage] ?? eng.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: healthColor }} title={eng.health ?? 'unknown'} />
                        </td>
                        <td className="px-4 py-3">
                          {roleCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: '#3B82F620', color: '#60A5FA' }}>
                              <Users className="w-2.5 h-2.5" />{roleCount} role{roleCount !== 1 ? 's' : ''}
                            </span>
                          ) : <span className="text-xs" style={{ color: DARK.textSecondary }}>—</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: DARK.textSecondary }}>
                          {eng.forecast_value > 0 ? `${eng.currency} ${eng.forecast_value.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: DARK.textSecondary }}>
                          {format(new Date(eng.updated_at), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ═══ ROW 6 — OUTREACH ACTIVITY ═══ */}
        {outreachMetrics && outreachMetrics.totalTargets > 0 && (
          <SectionCard title="Active Outreach" subtitle="Across all active recruitment campaigns" icon={Send} borderColor="#8B5CF6"
            jarvisSection="outreach"
            headerRight={<Link to="/outreach" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">View All →</Link>}>
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
                <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: DARK.hover, border: `1px solid ${DARK.border}` }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: DARK.textSecondary }}>{m.label}</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: DARK.text }}>{m.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ═══ MODALS ═══ */}
        <CreateEngagementModal open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setConvertDeal(null); }}
          prefillCompanyId={convertDeal?.company_id} prefillDealId={convertDeal?.id}
          prefillName={convertDeal ? `${convertDeal.name} — Delivery` : undefined} prefillValue={convertDeal?.value} />
        <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
        <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
        <CreateDealModal open={dealOpen} onOpenChange={setDealOpen} />
        <SowDetailSheet sow={selectedSow} open={sowSheetOpen} onOpenChange={setSowSheetOpen} />
        <ReportBuilderPanel open={reportOpen} onOpenChange={setReportOpen} preselectedType={reportPreselect} autoDownload={reportAutoDownload} />

        <GuidedTourPlayer tour={jarvisNav.tourState} onPause={jarvisNav.pauseTour} onResume={jarvisNav.resumeTour}
          onSkip={jarvisNav.skipTourStep} onStop={jarvisNav.stopTour} />
      </div>
    </div>
  );
};

export default HomeCommandCenter;
