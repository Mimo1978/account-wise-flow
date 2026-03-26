import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsCharts, type PipelineByStage, type InvoiceWeek, type OutreachOutcomeData } from '@/hooks/use-analytics-charts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRevenueIntelligence, type CompanyRiskProfile, type SalesMomentum } from '@/hooks/use-revenue-intelligence';
import { useDeals, DEAL_STAGE_LABELS } from '@/hooks/use-deals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle, UserX, Clock, Rocket,
  Target, Receipt, Building2, ChevronRight, Users, FileText, ArrowUpRight,
  ArrowDownRight, CalendarClock, Zap, ShieldAlert, Phone, CalendarCheck, Timer,
  Network,
} from 'lucide-react';
import { startOfDay, subDays, addMonths, startOfMonth, endOfMonth, format, differenceInDays } from 'date-fns';
import { PageBackButton } from '@/components/ui/page-back-button';

/* ─── Dark theme constants (matching Command Centre) ─── */
const D = {
  page: '#0F1117',
  card: '#1A1F2E',
  border: '#2D3748',
  text: '#F8FAFC',
  muted: '#94A3B8',
  hover: '#252B3B',
};

const TOOLTIP_STYLE = { background: D.card, border: `1px solid ${D.border}`, color: D.text, borderRadius: 8, fontSize: 12 };
const AXIS_TICK = { fontSize: 11, fill: D.muted };
const LEGEND_STYLE = { color: D.muted, fontSize: 12 };

// ── Lazy Section (Intersection Observer) ──
function LazySection({ children, height = 300, id }: { children: React.ReactNode; height?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  if (!visible) return <div ref={ref} id={id} style={{ minHeight: height }} className="space-y-4"><Skeleton className="h-6 w-48 rounded-md" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  return <div ref={ref} id={id}>{children}</div>;
}

// ── Date range presets ──
type DateRange = '7d' | '30d' | '90d' | 'year';
function getDateCutoff(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '90d': return subDays(now, 90);
    case 'year': return new Date(now.getFullYear(), 0, 1);
  }
}

// ── Stage colors matching chevrons ──
const STAGE_COLORS: Record<string, string> = {
  lead: '#3B82F6', Lead: '#3B82F6',
  qualified: '#6366F1', Qualified: '#6366F1',
  proposal: '#F59E0B', Proposal: '#F59E0B',
  negotiation: '#F97316', Negotiation: '#F97316',
  won: '#22C55E', Won: '#22C55E',
  lost: '#EF4444', Lost: '#EF4444',
};

// ── Analytics Section Card wrapper ──
function AnalyticsCard({ borderColor, icon: Icon, title, viewAllHref, viewAllLabel = 'View All', children, id, dataJarvisId, isEmpty }: {
  borderColor: string; icon: React.ElementType; title: string; viewAllHref?: string; viewAllLabel?: string;
  children: React.ReactNode; id?: string; dataJarvisId?: string; isEmpty?: boolean;
}) {
  return (
    <div
      id={id}
      data-jarvis-id={dataJarvisId}
      className="overflow-hidden flex flex-col"
      style={{ background: D.card, border: `1px solid ${D.border}`, borderLeft: `4px solid ${borderColor}`, borderRadius: 10, height: '100%' }}
    >
      <div className="flex items-center justify-between" style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${D.border}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${borderColor}15` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: borderColor }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: D.text }}>{title}</h3>
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs font-medium flex items-center gap-0.5 transition-colors" style={{ color: D.muted }} onMouseEnter={e => (e.currentTarget.style.color = D.text)} onMouseLeave={e => (e.currentTarget.style.color = D.muted)}>
            {viewAllLabel} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }} className={isEmpty ? 'items-center justify-center' : ''}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center w-full" style={{ flex: 1, border: `1px dashed ${D.border}`, borderRadius: 8 }}>
            <span className="text-xs" style={{ color: D.muted }}>No data yet</span>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Sticky Section Nav ──
const SECTIONS = [
  { id: 'sec-pipeline', label: 'Pipeline' },
  { id: 'sec-forecast', label: 'Forecast' },
  { id: 'sec-intelligence', label: 'Intelligence' },
  { id: 'sec-outreach', label: 'Outreach' },
  { id: 'sec-sales', label: 'Sales' },
  { id: 'sec-invoices', label: 'Invoices' },
  { id: 'sec-rsi', label: 'Relationships' },
];

function StickyNav() {
  const [active, setActive] = useState('sec-pipeline');

  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActive(entry.target.id); break; }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="sticky top-0 z-40 backdrop-blur-sm -mx-6 px-6" style={{ background: `${D.page}ee`, borderBottom: `1px solid ${D.border}` }}>
      <nav className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors"
            style={active === s.id
              ? { background: '#3B82F6', color: '#FFFFFF' }
              : { color: D.muted, background: 'transparent' }
            }
            onMouseEnter={e => { if (active !== s.id) { e.currentTarget.style.background = D.hover; e.currentTarget.style.color = D.text; } }}
            onMouseLeave={e => { if (active !== s.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = D.muted; } }}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ══════════════════════════════════════════
// Page
// ══════════════════════════════════════════
const ExecutiveInsights = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { data: riData, isLoading: riLoading } = useRevenueIntelligence();
  const { pipelineByStage, invoiceWeeks, outreachOutcomes, isLoading: chartsLoading } = useAnalyticsCharts(currentWorkspace?.id);
  const { data: deals = [] } = useDeals(currentWorkspace?.id);

  const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
  const wonDeals = deals.filter(d => d.stage === 'won');
  const lostDeals = deals.filter(d => d.stage === 'lost');
  const winRate = wonDeals.length + lostDeals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;

  const { atRiskCount = 0, singleThreadedCount = 0, dormantCount = 0, avgRsi = 0, rsiDistribution = { high: 0, medium: 0, low: 0 }, salesMomentum, companies = [] } = riData || {};

  const { data: expiringDocsCount = 0 } = useQuery({
    queryKey: ['analytics-docs-expiring', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;
      const cutoff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase.from('commercial_documents' as any).select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id).not('status', 'in', '("cancelled","expired")').lte('end_date', cutoff).not('end_date', 'is', null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });

  const kpiCards = [
    { label: 'Total Pipeline', value: `£${totalPipeline.toLocaleString()}`, subtitle: `${activeDeals.length} active deals`, icon: TrendingUp, accent: '#3B82F6', onClick: () => document.getElementById('sec-pipeline')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Win Rate', value: `${winRate}%`, subtitle: `${wonDeals.length} won / ${wonDeals.length + lostDeals.length} closed`, icon: Target, accent: '#10B981', onClick: () => document.getElementById('sec-sales')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Avg Response Rate', value: salesMomentum ? `${salesMomentum.responseRate}%` : '—', subtitle: salesMomentum ? `${salesMomentum.totalTargets} targets` : 'No outreach data', icon: Zap, accent: '#8B5CF6', onClick: () => document.getElementById('sec-outreach')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Documents Expiring', value: expiringDocsCount > 0 ? String(expiringDocsCount) : '—', subtitle: expiringDocsCount > 0 ? 'within 90 days' : 'Nothing upcoming', icon: FileText, accent: '#EF4444', onClick: () => navigate('/documents') },
  ];

  return (
    <div className="min-h-screen" style={{ background: D.page }}>
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-5">
        <PageBackButton />

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between" data-jarvis-id="analytics-date-range">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#3B82F615' }}>
              <BarChart3 className="w-5 h-5" style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: D.text }}>Analytics & Intelligence</h1>
              <p className="text-sm" style={{ color: D.muted }}>Performance data across your entire workspace</p>
            </div>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]" style={{ background: D.card, border: `1px solid ${D.border}`, color: D.text }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: D.card, border: `1px solid ${D.border}`, color: D.text }}>
              <SelectItem value="7d" className="focus:bg-[#252B3B] text-[#F8FAFC]">Last 7 days</SelectItem>
              <SelectItem value="30d" className="focus:bg-[#252B3B] text-[#F8FAFC]">Last 30 days</SelectItem>
              <SelectItem value="90d" className="focus:bg-[#252B3B] text-[#F8FAFC]">Last 90 days</SelectItem>
              <SelectItem value="year" className="focus:bg-[#252B3B] text-[#F8FAFC]">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs -mt-2" style={{ color: D.muted }}>Click any section to explore the detail. All data updates with the date range selector above.</p>

        <StickyNav />

        {/* ═══ ROW 1: 4 KPI HEADLINE CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" style={{ alignItems: 'stretch' }}>
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              onClick={kpi.onClick}
              className="cursor-pointer transition-all duration-150 overflow-hidden hover:scale-[1.02]"
              style={{ background: D.card, border: `1px solid ${D.border}`, borderLeft: `3px solid ${kpi.accent}`, borderRadius: 10 }}
            >
              <div style={{ padding: 14 }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${kpi.accent}1A` }}>
                    <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.accent }} />
                  </div>
                  <span className="font-medium uppercase tracking-wider" style={{ color: D.muted, fontSize: 10 }}>{kpi.label}</span>
                </div>
                <div className="font-bold tracking-tight" style={{ color: D.text, fontSize: 21 }}>{kpi.value}</div>
                <div className="mt-0.5" style={{ color: D.muted, fontSize: 10 }}>{kpi.subtitle}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ MAIN GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 12, alignItems: 'stretch' }}>
          {/* Pipeline (spans full) */}
          <div className="lg:col-span-1">
            <PipelineByStageChart data={pipelineByStage} isLoading={chartsLoading} />
          </div>
          <div className="lg:col-span-1">
            <RevenueForecast deals={deals} workspaceId={currentWorkspace?.id} />
          </div>

          {/* Account Intelligence — full width */}
          <div className="lg:col-span-2">
            <AnalyticsCard
              id="sec-intelligence"
              dataJarvisId="analytics-account-intelligence"
              borderColor="#F59E0B"
              icon={ShieldAlert}
              title="Account Intelligence"
              viewAllHref="/companies"
              viewAllLabel="View All Companies"
            >
              {riLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10, alignItems: 'stretch' }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10, alignItems: 'stretch' }}>
                  <IntelCard label="At-Risk Accounts" description="No activity in 60+ days with open deals" count={atRiskCount} icon={AlertTriangle} severity="danger" onClick={() => navigate('/companies?filter=at-risk')} />
                  <IntelCard label="Single-Threaded" description="Only 1 contact engaged at this company" count={singleThreadedCount} icon={UserX} severity="warning" onClick={() => navigate('/companies?filter=single-threaded')} />
                  <IntelCard label="Dormant Accounts" description="No contact in 90+ days" count={dormantCount} icon={Clock} severity="warning" onClick={() => navigate('/companies?filter=dormant')} />
                  <IntelCard label="High-Momentum" description="Responded and booked in last 30 days" count={riData?.pipeline?.highResponseCampaigns?.length ?? 0} icon={Rocket} severity="positive" onClick={() => navigate('/outreach?filter=high-momentum')} />
                </div>
              )}
            </AnalyticsCard>
          </div>

          {/* Outreach + Sales Momentum */}
          <LazySection height={350} id="sec-outreach">
            <AnalyticsCard borderColor="#8B5CF6" icon={Target} title="Outreach Outcomes (30 Days)" viewAllHref="/outreach" dataJarvisId="analytics-outreach">
              <OutreachOutcomesContent data={outreachOutcomes} isLoading={chartsLoading} />
            </AnalyticsCard>
          </LazySection>
          <LazySection height={350} id="sec-sales">
            <AnalyticsCard borderColor="#06B6D4" icon={BarChart3} title="Sales Momentum" viewAllHref="/outreach" dataJarvisId="analytics-sales-momentum">
              <SalesMomentumContent momentum={salesMomentum} isLoading={riLoading} />
            </AnalyticsCard>
          </LazySection>

          {/* Invoices — full width */}
          <div className="lg:col-span-2">
            <LazySection height={280} id="sec-invoices">
              <InvoicesByWeekCard data={invoiceWeeks} isLoading={chartsLoading} />
            </LazySection>
          </div>

          {/* RSI — full width */}
          <div className="lg:col-span-2">
            <LazySection height={200} id="sec-rsi">
              <RelationshipStrengthCard avgRsi={avgRsi} distribution={rsiDistribution} companies={companies} isLoading={riLoading} />
            </LazySection>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExecutiveInsights;

// ══════════════════════════════════════════
// Account Intelligence Card
// ══════════════════════════════════════════
function IntelCard({ label, description, count, icon: Icon, severity, onClick }: {
  label: string; description: string; count: number; icon: React.ElementType; severity: 'danger' | 'warning' | 'positive'; onClick?: () => void;
}) {
  const iconColors = { danger: '#EF4444', warning: '#F59E0B', positive: '#22C55E' };
  const ic = iconColors[severity];
  return (
    <div
      onClick={onClick}
      className="rounded-lg cursor-pointer transition-all"
      style={{ background: D.hover, border: `1px solid ${D.border}`, minHeight: 90, padding: 14 }}
      onMouseEnter={e => (e.currentTarget.style.background = '#2D3748')}
      onMouseLeave={e => (e.currentTarget.style.background = D.hover)}
    >
      <div className="p-2 rounded-lg w-fit mb-2" style={{ backgroundColor: `${ic}20` }}>
        <Icon className="w-4 h-4" style={{ color: ic }} />
      </div>
      <div className="text-3xl font-bold tracking-tight" style={{ color: D.text }}>{count}</div>
      <div className="text-xs font-medium mt-1 flex items-center gap-1" style={{ color: D.text }}>{label} <ChevronRight className="w-3 h-3" /></div>
      <div className="text-[10px] mt-0.5 leading-tight" style={{ color: D.muted }}>{description}</div>
    </div>
  );
}

// ══════════════════════════════════════════
// Pipeline Value by Stage Chart
// ══════════════════════════════════════════
function PipelineByStageChart({ data, isLoading }: { data: PipelineByStage[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const totalDeals = data.reduce((s, d) => s + d.count, 0);
  const totalValue = data.reduce((s, d) => s + d.totalValue, 0);

  if (isLoading) return <div id="sec-pipeline"><AnalyticsCard borderColor="#3B82F6" icon={BarChart3} title="Pipeline Value by Stage" viewAllHref="/crm/deals"><Skeleton className="h-[300px] rounded-xl" /></AnalyticsCard></div>;

  const formatted = data.map(d => ({ ...d, totalK: Math.round(d.totalValue / 1000), weightedK: Math.round(d.weightedValue / 1000) }));

  return (
    <AnalyticsCard
      id="sec-pipeline"
      borderColor="#3B82F6"
      icon={BarChart3}
      title="Pipeline Value by Stage"
      viewAllHref="/crm/deals"
      viewAllLabel="View All Deals"
      dataJarvisId="analytics-pipeline-chart"
    >
      {totalDeals > 0 && <p className="text-xs mb-3" style={{ color: D.muted }}>Total pipeline: £{totalValue.toLocaleString()} across {totalDeals} deals</p>}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: 200, border: `1px dashed ${D.border}`, borderRadius: 8 }}><span className="text-xs" style={{ color: D.muted }}>No deals yet — create deals to see pipeline analytics.</span></div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={formatted} barGap={4} style={{ background: 'transparent' }}>
            <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}k`} />
            <Tooltip formatter={(value: number, name: string) => [`£${value}k`, name === 'totalK' ? 'Total' : 'Weighted']} contentStyle={TOOLTIP_STYLE} />
            <Legend formatter={(v: string) => v === 'totalK' ? 'Total Value' : 'Weighted Value'} wrapperStyle={LEGEND_STYLE} />
            <Bar dataKey="totalK" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => entry?.stage && navigate(`/deals?stage=${entry.stage}`)}>
              {formatted.map((entry) => <Cell key={entry.stage} fill={`${STAGE_COLORS[entry.label] || '#6B7280'}40`} />)}
            </Bar>
            <Bar dataKey="weightedK" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => entry?.stage && navigate(`/deals?stage=${entry.stage}`)}>
              {formatted.map((entry) => <Cell key={entry.stage} fill={STAGE_COLORS[entry.label] || '#6B7280'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </AnalyticsCard>
  );
}

// ══════════════════════════════════════════
// Revenue Forecast (3-month forward)
// ══════════════════════════════════════════
function RevenueForecast({ deals, workspaceId }: { deals: any[]; workspaceId?: string }) {
  const now = new Date();
  const PROB_WEIGHTS: Record<string, number> = { lead: 0.1, qualified: 0.25, proposal: 0.5, negotiation: 0.75, won: 1, lost: 0 };

  const months = [0, 1, 2].map(offset => {
    const month = addMonths(now, offset);
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const monthDeals = deals.filter(d => {
      if (d.stage === 'lost' || d.stage === 'lead') return false;
      if (!d.expected_close_date) return false;
      const cd = new Date(d.expected_close_date);
      return cd >= mStart && cd <= mEnd;
    });
    const expected = monthDeals.reduce((s, d) => s + d.value, 0);
    const weighted = monthDeals.reduce((s, d) => s + Math.round(d.value * (PROB_WEIGHTS[d.stage] || 0.5)), 0);
    return { label: format(month, 'MMM yyyy'), expected, weighted, isCurrentMonth: offset === 0 };
  });

  const { data: invoicedThisMonth = 0 } = useQuery({
    queryKey: ['analytics-invoiced-month', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const mStart = startOfMonth(now).toISOString();
      const mEnd = endOfMonth(now).toISOString();
      const { data, error } = await supabase.from('invoices').select('amount').eq('workspace_id', workspaceId).gte('issue_date', mStart).lte('issue_date', mEnd);
      if (error) return 0;
      return (data || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AnalyticsCard
      id="sec-forecast"
      borderColor="#10B981"
      icon={TrendingUp}
      title="Revenue Forecast"
      viewAllHref="/deals?view=forecast"
      viewAllLabel="View All Deals"
      dataJarvisId="analytics-forecast"
    >
      <div className="space-y-3">
        {months.map((m, i) => (
          <div key={i} className="rounded-lg p-4" style={{ background: D.hover, border: `1px solid ${D.border}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: D.text }}>{m.label}</span>
              {m.isCurrentMonth && <Badge className="text-[10px] border-none" style={{ background: '#3B82F620', color: '#60A5FA' }}>Current</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span style={{ color: D.muted }}>Expected</span>
                <div className="text-lg font-bold" style={{ color: D.text }}>£{m.expected.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ color: D.muted }}>Weighted</span>
                <div className="text-lg font-bold" style={{ color: '#3B82F6' }}>£{m.weighted.toLocaleString()}</div>
              </div>
            </div>
            {m.isCurrentMonth && (
              <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${D.border}` }}>
                <span className="text-xs" style={{ color: D.muted }}>Invoiced: </span>
                <span className="text-xs font-semibold" style={{ color: D.text }}>£{invoicedThisMonth.toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 h-2 rounded-full overflow-hidden flex" style={{ background: D.border }}>
              {m.expected > 0 && <div className="h-full rounded-full" style={{ backgroundColor: '#10B98160', width: `${Math.min(100, (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
              {m.expected > 0 && <div className="h-full rounded-full" style={{ backgroundColor: '#10B981', width: `${Math.max(0, 100 - (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-center" style={{ color: D.muted }}>Forecast based on open deals and their pipeline stage probability.</p>
      </div>
    </AnalyticsCard>
  );
}

// ══════════════════════════════════════════
// Invoices Due / Overdue (8 Weeks)
// ══════════════════════════════════════════
function InvoicesByWeekCard({ data, isLoading }: { data: InvoiceWeek[]; isLoading: boolean }) {
  if (isLoading) return <AnalyticsCard borderColor="#EF4444" icon={Receipt} title="Invoice Timeline — Due & Overdue (8 Weeks)" viewAllHref="/documents" dataJarvisId="analytics-invoice-timeline"><Skeleton className="h-[260px] rounded-xl" /></AnalyticsCard>;
  const hasData = data.some(w => w.due > 0 || w.overdue > 0);
  const totalDue = data.reduce((s, w) => s + w.due, 0);
  const totalOverdue = data.reduce((s, w) => s + w.overdue, 0);

  const isEmpty = !hasData;
  return (
    <div style={isEmpty ? { maxHeight: 100 } : undefined}>
      <AnalyticsCard borderColor="#EF4444" icon={Receipt} title="Invoice Timeline — Due & Overdue (8 Weeks)" viewAllHref="/documents" viewAllLabel="View All Documents" dataJarvisId="analytics-invoice-timeline" isEmpty={isEmpty}>
        {hasData && (
          <p className="text-xs mb-3" style={{ color: D.muted }}>
            Due: <span className="font-semibold" style={{ color: D.text }}>{totalDue}</span> | Overdue: <span className="font-semibold" style={{ color: '#EF4444' }}>{totalOverdue}</span>
          </p>
        )}
        {hasData && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barGap={2} style={{ background: 'transparent' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
              <XAxis dataKey="weekLabel" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Bar dataKey="due" name="Due" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overdue" name="Overdue" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </AnalyticsCard>
    </div>
  );
}

// ══════════════════════════════════════════
// Outreach Outcomes
// ══════════════════════════════════════════
function OutreachOutcomesContent({ data, isLoading }: { data: OutreachOutcomeData; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />;
  const hasTargets = data.targetsByState.length > 0;
  const hasCalls = data.callOutcomesByType.length > 0;
  const STATE_COLORS_ARR = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#94A3B8'];

  if (!hasTargets && !hasCalls) {
    return <div className="flex items-center justify-center" style={{ minHeight: 80, border: `1px dashed ${D.border}`, borderRadius: 8 }}><span className="text-xs" style={{ color: D.muted }}>No data yet</span></div>;
  }

  return (
    <div className="space-y-4">
      {hasTargets && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: D.muted }}>Targets by State</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.targetsByState} layout="vertical" barSize={18} style={{ background: 'transparent' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={D.border} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="state" tick={AXIS_TICK} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.targetsByState.map((_, i) => <Cell key={i} fill={STATE_COLORS_ARR[i % STATE_COLORS_ARR.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasCalls && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: D.muted }}>Call Outcomes</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.callOutcomesByType} layout="vertical" barSize={18} style={{ background: 'transparent' }}>
              <CartesianGrid strokeDasharray="3 3" stroke={D.border} horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="outcome" tick={AXIS_TICK} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.callOutcomesByType.map((_, i) => <Cell key={i} fill={STATE_COLORS_ARR[i % STATE_COLORS_ARR.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// Sales Momentum
// ══════════════════════════════════════════
function SalesMomentumContent({ momentum, isLoading }: { momentum?: SalesMomentum; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />;
  if (!momentum || (momentum.totalTargets === 0 && momentum.totalCalls === 0)) {
    return <div className="flex items-center justify-center" style={{ minHeight: 80, border: `1px dashed ${D.border}`, borderRadius: 8 }}><span className="text-xs" style={{ color: D.muted }}>No data yet</span></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MomentumKpi label="Response Rate" value={`${momentum.responseRate}%`} detail={`${momentum.totalTargets} targets`} icon={Zap} accent="#8B5CF6" />
        <MomentumKpi label="Booking Rate" value={`${momentum.bookingRate}%`} detail={`${momentum.totalTargets} targets`} icon={CalendarCheck} accent="#22C55E" />
        <MomentumKpi label="Interest Rate" value={`${momentum.interestRate}%`} detail={`${momentum.totalCalls} calls`} icon={Target} accent="#3B82F6" />
        <div className="rounded-lg p-4" style={{ background: D.hover, border: `1px solid ${D.border}` }}>
          <div className="p-2 rounded-lg w-fit mb-2" style={{ background: `${D.border}` }}>
            <Timer className="w-4 h-4" style={{ color: D.muted }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: D.text }}>{momentum.avgFollowUpDelayDays !== null ? `${momentum.avgFollowUpDelayDays}d` : '—'}</div>
          <div className="text-xs mt-1" style={{ color: D.muted }}>Avg Follow-Up Delay</div>
        </div>
      </div>
      {momentum.highlightCampaigns.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: D.muted }}>Top Performing Sequences</p>
          <div className="space-y-2">
            {momentum.highlightCampaigns.map(c => (
              <Link key={c.id} to="/outreach" className="flex items-center justify-between p-3 rounded-lg transition-all"
                style={{ border: `1px solid ${D.border}`, background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = D.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="font-medium text-sm truncate" style={{ color: D.text }}>{c.name}</span>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs border-none" style={{ background: '#8B5CF620', color: '#A78BFA' }}>{c.responseRate}% resp</Badge>
                  <Badge className="text-xs border-none" style={{ background: '#22C55E20', color: '#4ADE80' }}>{c.bookingRate}% book</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MomentumKpi({ label, value, detail, icon: Icon, accent }: { label: string; value: string; detail: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: D.hover, border: `1px solid ${D.border}` }}>
      <div className="p-2 rounded-lg w-fit mb-2" style={{ background: `${accent}20` }}>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: D.text }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: D.muted }}>{label}</div>
      <div className="text-xs" style={{ color: D.muted }}>{detail}</div>
    </div>
  );
}

// ══════════════════════════════════════════
// Relationship Strength Index
// ══════════════════════════════════════════
function RelationshipStrengthCard({ avgRsi, distribution, companies, isLoading }: {
  avgRsi: number; distribution: { high: number; medium: number; low: number }; companies: CompanyRiskProfile[]; isLoading: boolean;
}) {
  if (isLoading) return <AnalyticsCard borderColor="#6366F1" icon={Network} title="Relationship Strength Index" viewAllHref="/companies?sort=rsi" dataJarvisId="analytics-rsi"><Skeleton className="h-[200px] rounded-xl" /></AnalyticsCard>;

  const total = distribution.high + distribution.medium + distribution.low || 1;
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

  const isEmpty = companies.length < 3;
  return (
    <div style={isEmpty ? { maxHeight: 120 } : undefined}>
      <AnalyticsCard borderColor="#6366F1" icon={Network} title="Relationship Strength Index" viewAllHref="/companies?sort=rsi" viewAllLabel="View All Companies" dataJarvisId="analytics-rsi" isEmpty={isEmpty}>
        {!isEmpty && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg p-4" style={{ background: D.hover, border: `1px solid ${D.border}` }}>
              <div className="text-sm mb-2" style={{ color: D.muted }}>Average RSI</div>
              <div className="text-4xl font-bold" style={{ color: D.text }}>{avgRsi}<span className="text-lg font-normal" style={{ color: D.muted }}>/100</span></div>
              <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: D.border }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${avgRsi}%`, background: '#6366F1' }} />
              </div>
            </div>
            <div className="md:col-span-2 rounded-lg p-4" style={{ background: D.hover, border: `1px solid ${D.border}` }}>
              <div className="text-sm mb-3" style={{ color: D.muted }}>Distribution</div>
              <div className="flex gap-3">
                <DistBar label="High (70+)" count={distribution.high} pct={highPct} color="#22C55E" />
                <DistBar label="Medium (40–69)" count={distribution.medium} pct={medPct} color="#F59E0B" />
                <DistBar label="Low (<40)" count={distribution.low} pct={lowPct} color="#EF4444" />
              </div>
            </div>
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}

function DistBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: D.muted }}>{label}</span>
        <span className="font-medium" style={{ color: D.text }}>{count}</span>
      </div>
      <div className="h-6 rounded-md overflow-hidden" style={{ background: D.border }}>
        <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
