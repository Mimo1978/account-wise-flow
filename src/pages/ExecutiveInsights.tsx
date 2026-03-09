import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalyticsCharts, type PipelineByStage, type InvoiceWeek, type OutreachOutcomeData } from '@/hooks/use-analytics-charts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRevenueIntelligence, type CompanyRiskProfile, type SalesMomentum } from '@/hooks/use-revenue-intelligence';
import { useDeals, DEAL_STAGE_LABELS } from '@/hooks/use-deals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
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
function AnalyticsCard({ borderColor, icon: Icon, title, viewAllHref, viewAllLabel = 'View All', children, id, dataJarvisId }: {
  borderColor: string; icon: React.ElementType; title: string; viewAllHref?: string; viewAllLabel?: string;
  children: React.ReactNode; id?: string; dataJarvisId?: string;
}) {
  return (
    <div
      id={id}
      data-jarvis-id={dataJarvisId}
      className="rounded-xl bg-card shadow-[0_1px_3px_hsl(0_0%_0%/0.08),0_1px_2px_hsl(0_0%_0%/0.04)] overflow-hidden"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${borderColor}15` }}>
            <Icon className="w-3.5 h-3.5" style={{ color: borderColor }} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5">
            {viewAllLabel} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {/* Card Body */}
      <div className="px-5 py-4">{children}</div>
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
    <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border/60 -mx-6 px-6">
      <nav className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              active === s.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
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

  // Documents expiring
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

  // KPI card color accents
  const kpiCards = [
    { label: 'Total Pipeline', value: `£${totalPipeline.toLocaleString()}`, subtitle: `${activeDeals.length} active deals`, icon: TrendingUp, accent: '#3B82F6', onClick: () => document.getElementById('sec-pipeline')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Win Rate', value: `${winRate}%`, subtitle: `${wonDeals.length} won / ${wonDeals.length + lostDeals.length} closed`, icon: Target, accent: '#10B981', onClick: () => document.getElementById('sec-sales')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Avg Response Rate', value: salesMomentum ? `${salesMomentum.responseRate}%` : '—', subtitle: salesMomentum ? `${salesMomentum.totalTargets} targets` : 'No outreach data', icon: Zap, accent: '#8B5CF6', onClick: () => document.getElementById('sec-outreach')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Documents Expiring', value: expiringDocsCount > 0 ? String(expiringDocsCount) : '—', subtitle: expiringDocsCount > 0 ? 'within 90 days' : 'Nothing upcoming', icon: FileText, accent: '#EF4444', onClick: () => navigate('/documents') },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(210 40% 98%)' }}>
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-5">
        <PageBackButton />

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between" data-jarvis-id="analytics-date-range">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics & Intelligence</h1>
              <p className="text-sm text-muted-foreground">Performance data across your entire workspace</p>
            </div>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subtitle hint */}
        <p className="text-xs text-muted-foreground -mt-2">Click any section to explore the detail. All data updates with the date range selector above.</p>

        {/* ═══ STICKY NAV ═══ */}
        <StickyNav />

        {/* ═══ ROW 1: 4 KPI HEADLINE CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              onClick={kpi.onClick}
              className="rounded-xl bg-card shadow-[0_1px_3px_hsl(0_0%_0%/0.08),0_1px_2px_hsl(0_0%_0%/0.04)] cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${kpi.accent}15` }}>
                    <kpi.icon className="w-4 h-4" style={{ color: kpi.accent }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</div>
              </div>
              <div className="h-1" style={{ backgroundColor: kpi.accent }} />
            </div>
          ))}
        </div>

        {/* ═══ ROW 2: PIPELINE CHART + REVENUE FORECAST ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <PipelineByStageChart data={pipelineByStage} isLoading={chartsLoading} />
          </div>
          <div className="lg:col-span-2">
            <RevenueForecast deals={deals} workspaceId={currentWorkspace?.id} />
          </div>
        </div>

        {/* ═══ ROW 3: ACCOUNT INTELLIGENCE ═══ */}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <IntelCard label="At-Risk Accounts" description="No activity in 60+ days with open deals" count={atRiskCount} icon={AlertTriangle} severity="danger" onClick={() => navigate('/companies?filter=at-risk')} />
              <IntelCard label="Single-Threaded" description="Only 1 contact engaged at this company" count={singleThreadedCount} icon={UserX} severity="warning" onClick={() => navigate('/companies?filter=single-threaded')} />
              <IntelCard label="Dormant Accounts" description="No contact in 90+ days" count={dormantCount} icon={Clock} severity="warning" onClick={() => navigate('/companies?filter=dormant')} />
              <IntelCard label="High-Momentum" description="Responded and booked in last 30 days" count={riData?.pipeline?.highResponseCampaigns?.length ?? 0} icon={Rocket} severity="positive" onClick={() => navigate('/outreach?filter=high-momentum')} />
            </div>
          )}
        </AnalyticsCard>

        {/* ═══ ROW 4: OUTREACH + SALES MOMENTUM ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
        </div>

        {/* ═══ ROW 5: INVOICES TIMELINE ═══ */}
        <LazySection height={280} id="sec-invoices">
          <InvoicesByWeekCard data={invoiceWeeks} isLoading={chartsLoading} />
        </LazySection>

        {/* ═══ ROW 6: RELATIONSHIP STRENGTH INDEX ═══ */}
        <LazySection height={200} id="sec-rsi">
          <RelationshipStrengthCard avgRsi={avgRsi} distribution={rsiDistribution} companies={companies} isLoading={riLoading} />
        </LazySection>

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
  const colors = {
    danger: { bg: 'hsl(0 84% 60% / 0.08)', iconBg: 'hsl(0 84% 60% / 0.15)', iconColor: 'hsl(0 84% 60%)' },
    warning: { bg: 'hsl(38 92% 50% / 0.08)', iconBg: 'hsl(38 92% 50% / 0.15)', iconColor: 'hsl(38 92% 50%)' },
    positive: { bg: 'hsl(142 71% 45% / 0.08)', iconBg: 'hsl(142 71% 45% / 0.15)', iconColor: 'hsl(142 71% 45%)' },
  };
  const c = colors[severity];
  return (
    <div
      onClick={onClick}
      className="rounded-lg p-4 cursor-pointer hover:shadow-md transition-all border border-border/30"
      style={{ backgroundColor: c.bg }}
    >
      <div className="p-2 rounded-lg w-fit mb-2" style={{ backgroundColor: c.iconBg }}>
        <Icon className="w-4 h-4" style={{ color: c.iconColor }} />
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{count}</div>
      <div className="text-xs font-medium text-foreground/80 mt-1 flex items-center gap-1">{label} <ChevronRight className="w-3 h-3" /></div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{description}</div>
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

  if (isLoading) return <div id="sec-pipeline"><AnalyticsCard borderColor="#3B82F6" icon={BarChart3} title="Pipeline Value by Stage" viewAllHref="/deals"><Skeleton className="h-[300px] rounded-xl" /></AnalyticsCard></div>;

  const formatted = data.map(d => ({ ...d, totalK: Math.round(d.totalValue / 1000), weightedK: Math.round(d.weightedValue / 1000) }));

  return (
    <AnalyticsCard
      id="sec-pipeline"
      borderColor="#3B82F6"
      icon={BarChart3}
      title="Pipeline Value by Stage"
      viewAllHref="/deals"
      viewAllLabel="View All Deals"
      dataJarvisId="analytics-pipeline-chart"
    >
      {totalDeals > 0 && <p className="text-xs text-muted-foreground mb-3">Total pipeline: £{totalValue.toLocaleString()} across {totalDeals} deals</p>}
      {data.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No deals yet. Create deals to see pipeline analytics.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={formatted} barGap={4}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}k`} />
            <Tooltip formatter={(value: number, name: string) => [`£${value}k`, name === 'totalK' ? 'Total' : 'Weighted']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend formatter={(v: string) => v === 'totalK' ? 'Total Value' : 'Weighted Value'} />
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
          <div key={i} className="rounded-lg border border-border/40 p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">{m.label}</span>
              {m.isCurrentMonth && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Expected</span>
                <div className="text-lg font-bold text-foreground">£{m.expected.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Weighted</span>
                <div className="text-lg font-bold text-primary">£{m.weighted.toLocaleString()}</div>
              </div>
            </div>
            {m.isCurrentMonth && (
              <div className="mt-2 pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Invoiced: </span>
                <span className="text-xs font-semibold text-foreground">£{invoicedThisMonth.toLocaleString()}</span>
              </div>
            )}
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
              {m.expected > 0 && <div className="h-full rounded-full" style={{ backgroundColor: '#10B98140', width: `${Math.min(100, (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
              {m.expected > 0 && <div className="h-full rounded-full" style={{ backgroundColor: '#10B981', width: `${Math.max(0, 100 - (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground text-center">Forecast based on open deals and their pipeline stage probability.</p>
      </div>
    </AnalyticsCard>
  );
}

// ══════════════════════════════════════════
// Invoices Due / Overdue (8 Weeks) — wrapped in AnalyticsCard
// ══════════════════════════════════════════
function InvoicesByWeekCard({ data, isLoading }: { data: InvoiceWeek[]; isLoading: boolean }) {
  if (isLoading) return <AnalyticsCard borderColor="#EF4444" icon={Receipt} title="Invoice Timeline — Due & Overdue (8 Weeks)" viewAllHref="/documents" dataJarvisId="analytics-invoice-timeline"><Skeleton className="h-[260px] rounded-xl" /></AnalyticsCard>;
  const hasData = data.some(w => w.due > 0 || w.overdue > 0);
  const totalDue = data.reduce((s, w) => s + w.due, 0);
  const totalOverdue = data.reduce((s, w) => s + w.overdue, 0);

  return (
    <AnalyticsCard borderColor="#EF4444" icon={Receipt} title="Invoice Timeline — Due & Overdue (8 Weeks)" viewAllHref="/documents" viewAllLabel="View All Documents" dataJarvisId="analytics-invoice-timeline">
      {hasData && (
        <p className="text-xs text-muted-foreground mb-3">
          Due: <span className="font-semibold text-foreground">{totalDue}</span> | Overdue: <span className="font-semibold text-destructive">{totalOverdue}</span>
        </p>
      )}
      {!hasData ? (
        <div className="text-center py-12 text-sm text-muted-foreground">No invoices due in the next 8 weeks.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={2}>
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend />
            <Bar dataKey="due" name="Due" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="overdue" name="Overdue" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </AnalyticsCard>
  );
}

// ══════════════════════════════════════════
// Outreach Outcomes (content only — inside AnalyticsCard)
// ══════════════════════════════════════════
function OutreachOutcomesContent({ data, isLoading }: { data: OutreachOutcomeData; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />;
  const hasTargets = data.targetsByState.length > 0;
  const hasCalls = data.callOutcomesByType.length > 0;
  const STATE_COLORS = ['hsl(var(--primary))', '#22C55E', '#F59E0B', '#EF4444', 'hsl(var(--muted-foreground))'];

  if (!hasTargets && !hasCalls) {
    return <div className="text-center py-12 text-sm text-muted-foreground">No outreach activity in the last 30 days.</div>;
  }

  return (
    <div className="space-y-4">
      {hasTargets && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Targets by State</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.targetsByState} layout="vertical" barSize={18}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.targetsByState.map((_, i) => <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasCalls && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Call Outcomes</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.callOutcomesByType} layout="vertical" barSize={18}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="outcome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.callOutcomesByType.map((_, i) => <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// Sales Momentum (content only — inside AnalyticsCard)
// ══════════════════════════════════════════
function SalesMomentumContent({ momentum, isLoading }: { momentum?: SalesMomentum; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />;
  if (!momentum || (momentum.totalTargets === 0 && momentum.totalCalls === 0)) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Create campaigns and log calls to track sales momentum.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MomentumKpi label="Response Rate" value={`${momentum.responseRate}%`} detail={`${momentum.totalTargets} targets`} icon={Zap} />
        <MomentumKpi label="Booking Rate" value={`${momentum.bookingRate}%`} detail={`${momentum.totalTargets} targets`} icon={CalendarCheck} />
        <MomentumKpi label="Interest Rate" value={`${momentum.interestRate}%`} detail={`${momentum.totalCalls} calls`} icon={Target} />
        <div className="rounded-lg border border-border/40 p-4 bg-muted/20">
          <div className="p-2 rounded-lg bg-muted w-fit mb-2"><Timer className="w-4 h-4 text-muted-foreground" /></div>
          <div className="text-2xl font-bold text-foreground">{momentum.avgFollowUpDelayDays !== null ? `${momentum.avgFollowUpDelayDays}d` : '—'}</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Follow-Up Delay</div>
        </div>
      </div>
      {momentum.highlightCampaigns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Top Performing Sequences</p>
          <div className="space-y-2">
            {momentum.highlightCampaigns.map(c => (
              <Link key={c.id} to="/outreach" className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-muted/30 transition-all">
                <span className="font-medium text-sm truncate">{c.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{c.responseRate}% resp</Badge>
                  <Badge variant="outline" className="text-xs">{c.bookingRate}% book</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MomentumKpi({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-border/40 p-4 bg-muted/20">
      <div className="p-2 rounded-lg bg-primary/10 w-fit mb-2"><Icon className="w-4 h-4 text-primary" /></div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

// ══════════════════════════════════════════
// Relationship Strength Index — wrapped in AnalyticsCard
// ══════════════════════════════════════════
function RelationshipStrengthCard({ avgRsi, distribution, companies, isLoading }: {
  avgRsi: number; distribution: { high: number; medium: number; low: number }; companies: CompanyRiskProfile[]; isLoading: boolean;
}) {
  if (isLoading) return <AnalyticsCard borderColor="#6366F1" icon={Network} title="Relationship Strength Index" viewAllHref="/companies?sort=rsi" dataJarvisId="analytics-rsi"><Skeleton className="h-[200px] rounded-xl" /></AnalyticsCard>;

  const total = distribution.high + distribution.medium + distribution.low || 1;
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

  return (
    <AnalyticsCard borderColor="#6366F1" icon={Network} title="Relationship Strength Index" viewAllHref="/companies?sort=rsi" viewAllLabel="View All Companies" dataJarvisId="analytics-rsi">
      {companies.length < 3 ? (
        <div className="flex items-center gap-4 py-4 justify-center max-h-[120px]">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0"><Users className="w-6 h-6 text-muted-foreground" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Add more companies and log activities to see your relationship health scores.</p>
            <Button size="sm" className="mt-2" asChild><Link to="/companies">Add Companies</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-lg p-4 bg-primary/5">
            <div className="text-sm text-muted-foreground mb-2">Average RSI</div>
            <div className="text-4xl font-bold text-foreground">{avgRsi}<span className="text-lg text-muted-foreground font-normal">/100</span></div>
            <Progress value={avgRsi} className="mt-3 h-2.5" />
          </div>
          <div className="md:col-span-2 rounded-lg border border-border/40 p-4">
            <div className="text-sm text-muted-foreground mb-3">Distribution</div>
            <div className="flex gap-3">
              <DistBar label="High (70+)" count={distribution.high} pct={highPct} color="#22C55E" />
              <DistBar label="Medium (40–69)" count={distribution.medium} pct={medPct} color="#F59E0B" />
              <DistBar label="Low (<40)" count={distribution.low} pct={lowPct} color="hsl(var(--destructive))" />
            </div>
          </div>
        </div>
      )}
    </AnalyticsCard>
  );
}

function DistBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
      <div className="h-6 bg-muted rounded-md overflow-hidden">
        <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
