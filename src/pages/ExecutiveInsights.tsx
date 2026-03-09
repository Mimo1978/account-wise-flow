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
} from 'lucide-react';
import { startOfDay, subDays, addMonths, startOfMonth, endOfMonth, format, differenceInDays } from 'date-fns';
import { PageBackButton } from '@/components/ui/page-back-button';

// ── Lazy Section (Intersection Observer) ──
function LazySection({ children, height = 300 }: { children: React.ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  if (!visible) return <div ref={ref} style={{ minHeight: height }} className="space-y-4"><Skeleton className="h-6 w-48 rounded-md" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  return <div ref={ref}>{children}</div>;
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

// ── Section Header ──
function SectionHeader({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
        <span className="tracking-tight">{title}</span>
      </h2>
      {children}
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
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

        {/* ═══ ROW 1: 4 KPI HEADLINE CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiHeadlineCard label="Total Pipeline" value={`£${totalPipeline.toLocaleString()}`} subtitle={`${activeDeals.length} active deals`} icon={TrendingUp} onClick={() => navigate('/deals')} />
          <KpiHeadlineCard label="Win Rate" value={`${winRate}%`} subtitle={`${wonDeals.length} won / ${wonDeals.length + lostDeals.length} closed`} icon={Target} />
          <KpiHeadlineCard label="Avg Response Rate" value={salesMomentum ? `${salesMomentum.responseRate}%` : '—'} subtitle={salesMomentum ? `${salesMomentum.totalTargets} targets` : 'No outreach data'} icon={Zap} />
          <KpiHeadlineCard label="Documents Expiring" value={expiringDocsCount > 0 ? String(expiringDocsCount) : '—'} subtitle={expiringDocsCount > 0 ? 'within 90 days' : 'Nothing upcoming'} icon={FileText} onClick={() => navigate('/documents')} />
        </div>

        {/* ═══ ROW 2: PIPELINE CHART + REVENUE FORECAST ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3" data-jarvis-id="analytics-pipeline-chart">
            <PipelineByStageChart data={pipelineByStage} isLoading={chartsLoading} />
          </div>
          <div className="lg:col-span-2" data-jarvis-id="analytics-forecast">
            <RevenueForecast deals={deals} workspaceId={currentWorkspace?.id} />
          </div>
        </div>

        {/* ═══ ROW 3: ACCOUNT INTELLIGENCE ═══ */}
        <section data-jarvis-id="analytics-account-intelligence">
          <SectionHeader icon={ShieldAlert} title="Account Intelligence" />
          {riLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <IntelCard label="At-Risk Accounts" count={atRiskCount} icon={AlertTriangle} severity="danger" onClick={() => navigate('/companies')} />
              <IntelCard label="Single-Threaded" count={singleThreadedCount} icon={UserX} severity="warning" onClick={() => navigate('/companies')} />
              <IntelCard label="Dormant Accounts" count={dormantCount} icon={Clock} severity="warning" onClick={() => navigate('/companies')} />
              <IntelCard label="High-Momentum Campaigns" count={riData?.pipeline?.highResponseCampaigns?.length ?? 0} icon={Rocket} severity="positive" onClick={() => navigate('/outreach')} />
            </div>
          )}
        </section>

        {/* ═══ ROW 4: OUTREACH + SALES MOMENTUM ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LazySection height={350}>
            <div data-jarvis-id="analytics-outreach">
              <OutreachOutcomesChart data={outreachOutcomes} isLoading={chartsLoading} />
            </div>
          </LazySection>
          <LazySection height={350}>
            <div data-jarvis-id="analytics-sales-momentum">
              <SalesMomentumSection momentum={salesMomentum} isLoading={riLoading} />
            </div>
          </LazySection>
        </div>

        {/* ═══ ROW 5: INVOICES TIMELINE ═══ */}
        <LazySection height={280}>
          <div data-jarvis-id="analytics-invoice-timeline">
            <InvoicesByWeekChart data={invoiceWeeks} isLoading={chartsLoading} />
          </div>
        </LazySection>

        {/* ═══ ROW 6: RELATIONSHIP STRENGTH INDEX ═══ */}
        <LazySection height={400}>
          <div data-jarvis-id="analytics-rsi">
            <RelationshipStrengthIndex avgRsi={avgRsi} distribution={rsiDistribution} companies={companies} isLoading={riLoading} />
          </div>
        </LazySection>

      </div>
    </div>
  );
};

export default ExecutiveInsights;

// ══════════════════════════════════════════
// KPI Headline Card
// ══════════════════════════════════════════
function KpiHeadlineCard({ label, value, subtitle, icon: Icon, onClick }: {
  label: string; value: string; subtitle: string; icon: React.ElementType; onClick?: () => void;
}) {
  return (
    <Card className={`border-0 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-primary/10"><Icon className="w-4 h-4 text-primary" /></div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════
// Account Intelligence Card
// ══════════════════════════════════════════
function IntelCard({ label, count, icon: Icon, severity, onClick }: {
  label: string; count: number; icon: React.ElementType; severity: 'danger' | 'warning' | 'positive'; onClick?: () => void;
}) {
  const bg = { danger: 'from-destructive/8 to-destructive/3 border-destructive/20', warning: 'from-amber-500/8 to-amber-500/3 border-amber-500/20', positive: 'from-green-500/8 to-green-500/3 border-green-500/20' };
  const iconBg = { danger: 'bg-destructive/15 text-destructive', warning: 'bg-amber-500/15 text-amber-600', positive: 'bg-green-500/15 text-green-600' };
  return (
    <Card className={`bg-gradient-to-br ${bg[severity]} cursor-pointer hover:shadow-md transition-all`} onClick={onClick}>
      <CardContent className="p-5">
        <div className={`p-2.5 rounded-xl ${iconBg[severity]} w-fit mb-3`}><Icon className="w-4 h-4" /></div>
        <div className="text-3xl font-bold tracking-tight">{count}</div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">{label}<ChevronRight className="w-3 h-3" /></div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════
// Pipeline Value by Stage Chart
// ══════════════════════════════════════════
function PipelineByStageChart({ data, isLoading }: { data: PipelineByStage[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const totalDeals = data.reduce((s, d) => s + d.count, 0);
  const totalValue = data.reduce((s, d) => s + d.totalValue, 0);

  if (isLoading) return <Card className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-[300px] rounded-xl" /></CardContent></Card>;

  const formatted = data.map(d => ({ ...d, totalK: Math.round(d.totalValue / 1000), weightedK: Math.round(d.weightedValue / 1000) }));

  return (
    <div>
      <SectionHeader icon={BarChart3} title="Pipeline Value by Stage">
        {totalDeals > 0 && <span className="text-xs text-muted-foreground">Total pipeline: £{totalValue.toLocaleString()} across {totalDeals} deals</span>}
      </SectionHeader>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
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
        </CardContent>
      </Card>
    </div>
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

  // Invoiced this month
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
    <div>
      <SectionHeader icon={TrendingUp} title="Revenue Forecast" />
      <div className="space-y-3">
        {months.map((m, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
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
              {/* Simple bar */}
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden flex">
                {m.expected > 0 && <div className="h-full bg-primary/30 rounded-full" style={{ width: `${Math.min(100, (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
                {m.expected > 0 && <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(0, 100 - (m.weighted / Math.max(m.expected, 1)) * 100)}%` }} />}
              </div>
            </CardContent>
          </Card>
        ))}
        <p className="text-[10px] text-muted-foreground text-center">Forecast based on open deals and their pipeline stage probability.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// Invoices Due / Overdue (8 Weeks)
// ══════════════════════════════════════════
function InvoicesByWeekChart({ data, isLoading }: { data: InvoiceWeek[]; isLoading: boolean }) {
  if (isLoading) return <Card className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-[260px] rounded-xl" /></CardContent></Card>;
  const hasData = data.some(w => w.due > 0 || w.overdue > 0);

  const totalDue = data.reduce((s, w) => s + w.due, 0);
  const totalOverdue = data.reduce((s, w) => s + w.overdue, 0);

  return (
    <div>
      <SectionHeader icon={Receipt} title="Invoices Due / Overdue (8 Weeks)">
        {hasData && <span className="text-xs text-muted-foreground">Due: {totalDue} | Overdue: {totalOverdue}</span>}
      </SectionHeader>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
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
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════
// Outreach Outcomes (30 Days)
// ══════════════════════════════════════════
function OutreachOutcomesChart({ data, isLoading }: { data: OutreachOutcomeData; isLoading: boolean }) {
  if (isLoading) return <Card className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-[300px] rounded-xl" /></CardContent></Card>;
  const hasTargets = data.targetsByState.length > 0;
  const hasCalls = data.callOutcomesByType.length > 0;
  const STATE_COLORS = ['hsl(var(--primary))', '#22C55E', '#F59E0B', '#EF4444', 'hsl(var(--muted-foreground))'];

  return (
    <div>
      <SectionHeader icon={Target} title="Outreach Outcomes (30 Days)" />
      {!hasTargets && !hasCalls ? (
        <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-sm text-muted-foreground">No outreach activity in the last 30 days.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {hasTargets && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Targets by State</CardTitle></CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.targetsByState} layout="vertical" barSize={18}>
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.targetsByState.map((_, i) => <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {hasCalls && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Call Outcomes</CardTitle></CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.callOutcomesByType} layout="vertical" barSize={18}>
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="outcome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>{data.callOutcomesByType.map((_, i) => <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// Sales Momentum
// ══════════════════════════════════════════
function SalesMomentumSection({ momentum, isLoading }: { momentum?: SalesMomentum; isLoading: boolean }) {
  if (isLoading) return <Card className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-[300px] rounded-xl" /></CardContent></Card>;
  if (!momentum || (momentum.totalTargets === 0 && momentum.totalCalls === 0)) {
    return (
      <div>
        <SectionHeader icon={BarChart3} title="Sales Momentum" />
        <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-sm text-muted-foreground">Create campaigns and log calls to track sales momentum.</CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader icon={BarChart3} title="Sales Momentum" />
      <div className="grid grid-cols-2 gap-3">
        <MomentumKpi label="Response Rate" value={`${momentum.responseRate}%`} detail={`${momentum.totalTargets} targets`} icon={Zap} />
        <MomentumKpi label="Booking Rate" value={`${momentum.bookingRate}%`} detail={`${momentum.totalTargets} targets`} icon={CalendarCheck} />
        <MomentumKpi label="Interest Rate" value={`${momentum.interestRate}%`} detail={`${momentum.totalCalls} calls`} icon={Target} />
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg bg-muted w-fit mb-2"><Timer className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-2xl font-bold">{momentum.avgFollowUpDelayDays !== null ? `${momentum.avgFollowUpDelayDays}d` : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Avg Follow-Up Delay</div>
          </CardContent>
        </Card>
      </div>
      {momentum.highlightCampaigns.length > 0 && (
        <Card className="mt-3 border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Performing Sequences</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {momentum.highlightCampaigns.map(c => (
                <Link key={c.id} to="/outreach" className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all">
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{c.responseRate}% resp</Badge>
                    <Badge variant="outline" className="text-xs">{c.bookingRate}% book</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MomentumKpi({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ElementType }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="p-2 rounded-lg bg-primary/10 w-fit mb-2"><Icon className="w-4 h-4 text-primary" /></div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════
// Relationship Strength Index
// ══════════════════════════════════════════
function RelationshipStrengthIndex({ avgRsi, distribution, companies, isLoading }: {
  avgRsi: number; distribution: { high: number; medium: number; low: number }; companies: CompanyRiskProfile[]; isLoading: boolean;
}) {
  if (isLoading) return <Card className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-[300px] rounded-xl" /></CardContent></Card>;

  const total = distribution.high + distribution.medium + distribution.low || 1;
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

  if (companies.length < 3) {
    return (
      <div>
        <SectionHeader icon={TrendingUp} title="Relationship Strength Index" />
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3"><Users className="w-6 h-6 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">Add more companies and log activities to see your relationship health scores.</p>
            <Button size="sm" className="mt-4" asChild><Link to="/companies">Add Companies</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader icon={TrendingUp} title="Relationship Strength Index" />
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-2">Average RSI</div>
            <div className="text-4xl font-bold">{avgRsi}<span className="text-lg text-muted-foreground font-normal">/100</span></div>
            <Progress value={avgRsi} className="mt-3 h-2.5" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-3">Distribution</div>
            <div className="flex gap-3">
              <DistBar label="High (70+)" count={distribution.high} pct={highPct} color="bg-green-500" />
              <DistBar label="Medium (40–69)" count={distribution.medium} pct={medPct} color="bg-amber-500" />
              <DistBar label="Low (<40)" count={distribution.low} pct={lowPct} color="bg-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DistBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-6 bg-muted rounded-md overflow-hidden">
        <div className={`h-full ${color} rounded-md transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
