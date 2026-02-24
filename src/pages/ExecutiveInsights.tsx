import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAnalyticsCharts, type PipelineByStage, type InvoiceWeek, type OutreachOutcomeData } from '@/hooks/use-analytics-charts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Users,
  Building2,
  ChevronRight,
  Zap,
  Phone,
  CalendarCheck,
  Network,
  UserCheck,
  UserX,
  Clock,
  Rocket,
  Eye,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  BarChart3,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useRevenueIntelligence, type CompanyRiskProfile, type RevenueIntelligenceData, type SalesMomentum } from '@/hooks/use-revenue-intelligence';

// ── Page ──

const ExecutiveInsights = () => {
  const { data, isLoading } = useRevenueIntelligence();
  const { currentWorkspace } = useWorkspace();
  const { pipelineByStage, invoiceWeeks, outreachOutcomes, isLoading: chartsLoading } = useAnalyticsCharts(currentWorkspace?.id);

  if (isLoading) return <FullPageSkeleton />;

  const { companies, atRiskCount, singleThreadedCount, dormantCount, avgRsi, rsiDistribution, pipeline, salesMomentum, riskSummary } = data;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-subtle)' }}>
      <div className="container mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Revenue Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Portfolio health · Pipeline signals · Relationship strength
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ── Main Content ── */}
          <div className="lg:col-span-3 space-y-8">
            {/* §1 Revenue Risk Snapshot */}
            <RevenueRiskSnapshot
              atRiskCount={atRiskCount}
              singleThreadedCount={singleThreadedCount}
              dormantCount={dormantCount}
              companies={companies}
              riskSummary={riskSummary}
            />

            {/* §2 Relationship Strength Index */}
            <RelationshipStrengthIndex
              avgRsi={avgRsi}
              distribution={rsiDistribution}
              companies={companies}
            />

            {/* §3 Pipeline Acceleration Signals */}
            <PipelineAcceleration pipeline={pipeline} />

            {/* §3b Analytics Charts */}
            {!chartsLoading && (
              <>
                <PipelineByStageChart data={pipelineByStage} />
                <InvoicesByWeekChart data={invoiceWeeks} />
                <OutreachOutcomesChart data={outreachOutcomes} />
              </>
            )}

            {/* §4 Sales Momentum */}
            <SalesMomentumSection momentum={salesMomentum} />

            {/* §5 Org Penetration Analytics */}
            <OrgPenetrationHeatmap companies={companies} />
          </div>

          {/* ── Action Panel (sticky) ── */}
          <div className="lg:col-span-1">
            <ActionPanel
              atRiskCount={atRiskCount}
              singleThreadedCount={singleThreadedCount}
              dormantCount={dormantCount}
              highMomentumCampaigns={pipeline.highResponseCampaigns.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveInsights;

// ════════════════════════════════════════════════════════════
// §1 — Revenue Risk Snapshot
// ════════════════════════════════════════════════════════════

function RevenueRiskSnapshot({
  atRiskCount,
  singleThreadedCount,
  dormantCount,
  companies,
  riskSummary,
}: {
  atRiskCount: number;
  singleThreadedCount: number;
  dormantCount: number;
  companies: CompanyRiskProfile[];
  riskSummary: RevenueIntelligenceData['riskSummary'];
}) {
  const highRiskCompanies = companies.filter(c => c.riskBand === 'high_risk').slice(0, 5);

  return (
    <section>
      <SectionHeader icon={ShieldAlert} iconColor="text-destructive" title="Revenue Risk Snapshot" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <RiskKpiCard
          label="High Risk"
          value={riskSummary.high_risk}
          subtitle="Score 51+"
          icon={AlertTriangle}
          severity={riskSummary.high_risk > 0 ? 'danger' : 'safe'}
          linkTo="/companies"
        />
        <RiskKpiCard
          label="Medium Risk"
          value={riskSummary.medium_risk}
          subtitle="Score 21–50"
          icon={UserX}
          severity={riskSummary.medium_risk > 0 ? 'warning' : 'safe'}
          linkTo="/companies"
        />
        <RiskKpiCard
          label="Healthy"
          value={riskSummary.healthy}
          subtitle="Score 0–20"
          icon={UserCheck}
          severity="safe"
          linkTo="/companies"
        />
      </div>

      {/* Top high-risk accounts with reasons */}
      {highRiskCompanies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Risk Accounts</CardTitle>
            <CardDescription>Deterministic scoring: +40 dormant, +30 single contact, +20 no exec, +10 snoozed/opted-out</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {highRiskCompanies.map(c => (
                <Link
                  key={c.id}
                  to={`/canvas?company=${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5 transition-all"
                >
                  <div className="w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.riskReasons.join(' · ')}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-xs font-semibold tabular-nums shrink-0">
                    {c.riskScore}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function RiskKpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  severity,
  linkTo,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  severity: 'danger' | 'warning' | 'safe';
  linkTo: string;
}) {
  const gradients = {
    danger: 'from-destructive/8 to-destructive/3 border-destructive/20',
    warning: 'from-warning/8 to-warning/3 border-warning/20',
    safe: 'from-success/8 to-success/3 border-success/20',
  };
  const iconBg = {
    danger: 'bg-destructive/15 text-destructive',
    warning: 'bg-warning/15 text-warning',
    safe: 'bg-success/15 text-success',
  };
  const TrendIcon = value > 0
    ? (severity === 'safe' ? ArrowUpRight : ArrowDownRight)
    : null;
  const trendColor = severity === 'safe' ? 'text-success' : severity === 'danger' ? 'text-destructive' : 'text-warning';

  return (
    <Link to={linkTo}>
      <Card className={`bg-gradient-to-br ${gradients[severity]} hover:shadow-lg transition-all duration-200 cursor-pointer group`} style={{ boxShadow: 'var(--shadow-sm)' }}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl ${iconBg[severity]}`}>
              <Icon className="w-5 h-5" />
            </div>
            {TrendIcon && <TrendIcon className={`w-5 h-5 ${trendColor} opacity-60`} />}
          </div>
          <div className="text-4xl font-bold tracking-tight mb-1">{value}</div>
          <div className="text-sm font-semibold text-foreground/80">{label}</div>
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            {subtitle}
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ════════════════════════════════════════════════════════════
// §2 — Relationship Strength Index
// ════════════════════════════════════════════════════════════

function RelationshipStrengthIndex({
  avgRsi,
  distribution,
  companies,
}: {
  avgRsi: number;
  distribution: { high: number; medium: number; low: number };
  companies: CompanyRiskProfile[];
}) {
  const [bandFilter, setBandFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const total = distribution.high + distribution.medium + distribution.low || 1;
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

  const filtered = bandFilter === 'all'
    ? companies.slice().sort((a, b) => a.rsiScore - b.rsiScore)
    : companies.filter(c => c.rsiTier === bandFilter).sort((a, b) => a.rsiScore - b.rsiScore);

  return (
    <section>
      <SectionHeader icon={TrendingUp} title="Relationship Strength Index" />

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {/* Average RSI */}
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/15" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Average RSI</div>
            <div className="text-4xl font-bold tracking-tight">{avgRsi}<span className="text-lg text-muted-foreground font-normal">/100</span></div>
            <Progress value={avgRsi} className="mt-3 h-2.5" />
            <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Base 100 · −20 no exec · −15 single dept · −10 no activity 45d · +10 &gt;3 contacts · +10 response &gt;25%
            </div>
          </CardContent>
        </Card>

        {/* Distribution — clickable bars */}
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-3">Distribution (click to filter)</div>
            <div className="flex gap-3">
              <DistributionBar label="High (70+)" count={distribution.high} pct={highPct} color="bg-success" active={bandFilter === 'high'} onClick={() => setBandFilter(f => f === 'high' ? 'all' : 'high')} />
              <DistributionBar label="Medium (40–69)" count={distribution.medium} pct={medPct} color="bg-warning" active={bandFilter === 'medium'} onClick={() => setBandFilter(f => f === 'medium' ? 'all' : 'medium')} />
              <DistributionBar label="Low (<40)" count={distribution.low} pct={lowPct} color="bg-destructive" active={bandFilter === 'low'} onClick={() => setBandFilter(f => f === 'low' ? 'all' : 'low')} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-account RSI list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Account RSI Scores</CardTitle>
            {bandFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setBandFilter('all')}>
                Showing: {bandFilter} · Clear
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState icon={Users} message={bandFilter !== 'all' ? `No ${bandFilter}-tier accounts found. Adjust filters or add contacts with senior titles to improve coverage.` : 'No companies with executive coverage yet. Add a senior stakeholder to reduce risk.'} action={{ label: 'Add company', to: '/companies' }} />
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 12).map(c => (
                <Link
                  key={c.id}
                  to={`/canvas?company=${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.totalContacts} contacts · {c.seniorContacts} senior · {c.departments.length} depts
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RsiBadge score={c.rsiScore} tier={c.rsiTier} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DistributionBar({ label, count, pct, color, active, onClick }: { label: string; count: number; pct: number; color: string; active?: boolean; onClick?: () => void }) {
  return (
    <div className={`flex-1 cursor-pointer rounded-lg p-2 transition-all ${active ? 'ring-2 ring-primary bg-muted/50' : 'hover:bg-muted/30'}`} onClick={onClick}>
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

function RsiBadge({ score, tier }: { score: number; tier: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <Badge variant="outline" className={`text-xs font-semibold tabular-nums ${styles[tier]}`}>
      {score}
    </Badge>
  );
}

// ════════════════════════════════════════════════════════════
// §3 — Pipeline Acceleration Signals
// ════════════════════════════════════════════════════════════

function PipelineAcceleration({ pipeline }: { pipeline: ReturnType<typeof useRevenueIntelligence>['data']['pipeline'] }) {
  const hasSignals = pipeline.respondedTargets > 0 || pipeline.bookedTargets > 0 || pipeline.interestedOutcomes > 0 || pipeline.meetingBookedOutcomes > 0 || pipeline.highResponseCampaigns.length > 0;

  return (
    <section>
      <SectionHeader icon={Rocket} title="Pipeline Acceleration Signals" />

      {!hasSignals ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={Zap} message="No outreach targets or call outcomes recorded. Create a campaign and add targets to see response and booking signals here." action={{ label: 'Create campaign', to: '/outreach' }} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <PipelineStat icon={Zap} label="Responded" value={pipeline.respondedTargets} linkTo="/outreach" />
          <PipelineStat icon={CalendarCheck} label="Booked" value={pipeline.bookedTargets} linkTo="/outreach" />
          <PipelineStat icon={Phone} label="Interested" value={pipeline.interestedOutcomes} linkTo="/outreach" />
          <PipelineStat icon={Target} label="Meetings Booked" value={pipeline.meetingBookedOutcomes} linkTo="/outreach" />
        </div>
      )}

      {pipeline.highResponseCampaigns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">High-Momentum Campaigns (&gt;20% response rate)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipeline.highResponseCampaigns.map(c => (
                <Link
                  key={c.id}
                  to="/outreach"
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
                >
                  <span className="font-medium text-sm truncate">{c.name}</span>
                  <Badge variant="secondary" className="text-xs font-semibold">{c.responseRate}% response</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function PipelineStat({ icon: Icon, label, value, linkTo }: { icon: React.ElementType; label: string; value: number; linkTo: string }) {
  return (
    <Link to={linkTo}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            {value > 0 && <ArrowUpRight className="w-4 h-4 text-success opacity-60" />}
          </div>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {label}
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ════════════════════════════════════════════════════════════
// §4 — Sales Momentum
// ════════════════════════════════════════════════════════════

const RESPONSE_THRESHOLD = 30;
const BOOKING_THRESHOLD = 20;
const INTEREST_THRESHOLD = 15;

function SalesMomentumSection({ momentum }: { momentum: SalesMomentum }) {
  const { totalTargets, responseRate, bookingRate, interestRate, avgFollowUpDelayDays, totalCalls, highlightCampaigns } = momentum;
  const hasData = totalTargets > 0 || totalCalls > 0;

  return (
    <section>
      <SectionHeader icon={BarChart3} title="Sales Momentum" />

      {!hasData ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={BarChart3} message="Response, booking, and interest rates require outreach activity. Create a campaign and log call outcomes to track sales momentum." action={{ label: 'Create campaign', to: '/outreach' }} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MomentumKpi
              label="Response Rate"
              value={`${responseRate}%`}
              detail={`${totalTargets} targets`}
              threshold={RESPONSE_THRESHOLD}
              actual={responseRate}
              icon={Zap}
            />
            <MomentumKpi
              label="Booking Rate"
              value={`${bookingRate}%`}
              detail={`${totalTargets} targets`}
              threshold={BOOKING_THRESHOLD}
              actual={bookingRate}
              icon={CalendarCheck}
            />
            <MomentumKpi
              label="Interest Rate"
              value={`${interestRate}%`}
              detail={`${totalCalls} calls`}
              threshold={INTEREST_THRESHOLD}
              actual={interestRate}
              icon={Target}
            />
            <Card style={{ boxShadow: 'var(--shadow-sm)' }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {avgFollowUpDelayDays !== null ? `${avgFollowUpDelayDays}d` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Avg Follow-Up Delay</div>
                <div className="text-xs text-muted-foreground mt-0.5">called_at → follow_up_due</div>
              </CardContent>
            </Card>
          </div>

          {highlightCampaigns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Highlight Campaigns (≥{RESPONSE_THRESHOLD}% response or ≥{BOOKING_THRESHOLD}% booking)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {highlightCampaigns.map(c => (
                    <Link
                      key={c.id}
                      to="/outreach"
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
                    >
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-semibold">{c.responseRate}% resp</Badge>
                        <Badge variant="outline" className="text-xs font-semibold">{c.bookingRate}% book</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function MomentumKpi({
  label,
  value,
  detail,
  threshold,
  actual,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  threshold: number;
  actual: number;
  icon: React.ElementType;
}) {
  const meetsThreshold = actual >= threshold;
  return (
    <Card className={`transition-all duration-200 ${meetsThreshold ? 'border-success/30 bg-gradient-to-br from-success/5 to-transparent' : ''}`} style={{ boxShadow: 'var(--shadow-sm)' }}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          {meetsThreshold ? (
            <ArrowUpRight className="w-4 h-4 text-success" />
          ) : actual > 0 ? (
            <ArrowDownRight className="w-4 h-4 text-muted-foreground opacity-40" />
          ) : null}
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
        <div className={`text-xs mt-2 font-medium ${meetsThreshold ? 'text-success' : 'text-muted-foreground'}`}>
          Target: ≥{threshold}% {meetsThreshold ? '✓' : ''}
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// §5 — Org Penetration Analytics
// ════════════════════════════════════════════════════════════

type SortKey = 'name' | 'totalContacts' | 'seniorContacts' | 'departments' | 'lastActivity' | 'riskBand' | 'rsiScore';
type SortDir = 'asc' | 'desc';

function OrgPenetrationHeatmap({ companies }: { companies: CompanyRiskProfile[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('rsiScore');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showWeakest, setShowWeakest] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const riskBandOrder: Record<string, number> = { high_risk: 0, medium_risk: 1, healthy: 2 };

  const sorted = companies.slice().sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'totalContacts': cmp = a.totalContacts - b.totalContacts; break;
      case 'seniorContacts': cmp = a.seniorContacts - b.seniorContacts; break;
      case 'departments': cmp = a.departments.length - b.departments.length; break;
      case 'lastActivity': cmp = (a.daysSinceActivity ?? 9999) - (b.daysSinceActivity ?? 9999); break;
      case 'riskBand': cmp = (riskBandOrder[a.riskBand] ?? 2) - (riskBandOrder[b.riskBand] ?? 2); break;
      case 'rsiScore': cmp = a.rsiScore - b.rsiScore; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const displayed = showWeakest
    ? companies.slice().sort((a, b) => a.rsiScore - b.rsiScore).slice(0, 10)
    : sorted;

  if (companies.length === 0) {
    return (
      <section>
        <SectionHeader icon={Network} title="Org Penetration Analytics" />
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={Building2} message="No companies in your workspace yet. Add a company and its contacts to see penetration analytics, department coverage, and risk scoring." action={{ label: 'Add company', to: '/companies' }} secondaryAction={{ label: 'Import contacts', to: '/contacts' }} />
          </CardContent>
        </Card>
      </section>
    );
  }

  const SortHeader = ({ label, field, className = '' }: { label: string; field: SortKey; className?: string }) => (
    <th
      className={`p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  );

  const riskBadgeStyle: Record<string, string> = {
    high_risk: 'bg-red-100 text-red-700 border-red-200',
    medium_risk: 'bg-amber-100 text-amber-700 border-amber-200',
    healthy: 'bg-green-100 text-green-700 border-green-200',
  };
  const riskLabel: Record<string, string> = { high_risk: 'High', medium_risk: 'Medium', healthy: 'Healthy' };

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <SectionHeader icon={Network} title="Org Penetration Analytics" className="mb-0" />
        <Button
          variant={showWeakest ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowWeakest(w => !w)}
        >
          <Eye className="w-4 h-4 mr-1" />
          {showWeakest ? 'Show all' : 'Top 10 weakest'}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <SortHeader label="Account" field="name" className="text-left" />
                  <SortHeader label="Contacts" field="totalContacts" className="text-center" />
                  <SortHeader label="Senior" field="seniorContacts" className="text-center" />
                  <SortHeader label="Depts" field="departments" className="text-center" />
                  <SortHeader label="Last Activity" field="lastActivity" className="text-center" />
                  <SortHeader label="Risk" field="riskBand" className="text-center" />
                  <SortHeader label="RSI" field="rsiScore" className="text-center" />
                  <th className="p-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayed.map(c => (
                  <tr key={c.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link to={`/canvas?company=${c.id}`} className="font-medium hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="p-3 text-center tabular-nums">{c.totalContacts}</td>
                    <td className="p-3 text-center">
                      {c.seniorContacts > 0
                        ? <Badge variant="outline" className="text-xs border-green-200 text-green-700">Yes ({c.seniorContacts})</Badge>
                        : <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">No</Badge>}
                    </td>
                    <td className="p-3 text-center tabular-nums">{c.departments.length}</td>
                    <td className="p-3 text-center text-xs tabular-nums">
                      {c.lastActivityDate
                        ? <span className={c.daysSinceActivity !== null && c.daysSinceActivity > 60 ? 'text-destructive font-medium' : ''}>
                            {c.daysSinceActivity}d ago
                          </span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`text-xs ${riskBadgeStyle[c.riskBand] || ''}`}>
                        {riskLabel[c.riskBand] || c.riskBand}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <RsiBadge score={c.rsiScore} tier={c.rsiTier} />
                    </td>
                    <td className="p-3">
                      <Link to={`/canvas?company=${c.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ════════════════════════════════════════════════════════════
// §5 — Action Panel (sticky sidebar)
// ════════════════════════════════════════════════════════════

function ActionPanel({
  atRiskCount,
  singleThreadedCount,
  dormantCount,
  highMomentumCampaigns,
}: {
  atRiskCount: number;
  singleThreadedCount: number;
  dormantCount: number;
  highMomentumCampaigns: number;
}) {
  return (
    <div className="lg:sticky lg:top-10 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ActionLink
            to="/companies"
            icon={AlertTriangle}
            label="At-Risk Accounts"
            count={atRiskCount}
            severity={atRiskCount > 0 ? 'danger' : 'neutral'}
          />
          <ActionLink
            to="/companies"
            icon={UserX}
            label="Single-Threaded"
            count={singleThreadedCount}
            severity={singleThreadedCount > 0 ? 'warning' : 'neutral'}
          />
          <ActionLink
            to="/companies"
            icon={Clock}
            label="Dormant Accounts"
            count={dormantCount}
            severity={dormantCount > 0 ? 'warning' : 'neutral'}
          />
          <ActionLink
            to="/outreach"
            icon={Rocket}
            label="High-Momentum Campaigns"
            count={highMomentumCampaigns}
            severity={highMomentumCampaigns > 0 ? 'positive' : 'neutral'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">
            All metrics computed from live data. No static values or placeholders.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionLink({
  to,
  icon: Icon,
  label,
  count,
  severity,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  count: number;
  severity: 'danger' | 'warning' | 'positive' | 'neutral';
}) {
  const dotColor = {
    danger: 'bg-destructive',
    warning: 'bg-amber-400',
    positive: 'bg-green-500',
    neutral: 'bg-muted-foreground/30',
  };

  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm flex-1">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor[severity]}`} />
        <span className="text-sm font-semibold tabular-nums">{count}</span>
      </span>
    </Link>
  );
}

// ── Shared components ──

function SectionHeader({ icon: Icon, title, iconColor, className = '' }: { icon: React.ElementType; title: string; iconColor?: string; className?: string }) {
  return (
    <h2 className={`text-lg font-semibold mb-5 flex items-center gap-2.5 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className={`w-4 h-4 ${iconColor || 'text-primary'}`} />
      </div>
      <span className="tracking-tight">{title}</span>
    </h2>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
  secondaryAction,
}: {
  icon: React.ElementType;
  message: string;
  action?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
}) {
  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{message}</p>
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {action && (
            <Link to={action.to}>
              <Button size="sm" variant="default">{action.label}</Button>
            </Link>
          )}
          {secondaryAction && (
            <Link to={secondaryAction.to}>
              <Button size="sm" variant="outline">{secondaryAction.label}</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Analytics Charts
// ════════════════════════════════════════════════════════════

const STAGE_COLORS: Record<string, string> = {
  Lead: 'hsl(var(--muted-foreground))',
  Qualified: 'hsl(var(--primary))',
  Proposal: 'hsl(220 70% 55%)',
  Negotiation: 'hsl(40 90% 50%)',
  Won: 'hsl(142 70% 45%)',
  Lost: 'hsl(0 70% 50%)',
};

function PipelineByStageChart({ data }: { data: PipelineByStage[] }) {
  if (data.length === 0) return null;
  const formatted = data.map(d => ({
    ...d,
    totalK: Math.round(d.totalValue / 1000),
    weightedK: Math.round(d.weightedValue / 1000),
  }));

  return (
    <section>
      <SectionHeader icon={BarChart3} title="Pipeline Value by Stage" />
      <Card>
        <CardContent className="p-5">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formatted} barGap={4}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `£${v}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [`£${value}k`, name === 'totalK' ? 'Total' : 'Weighted']}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend formatter={(v: string) => v === 'totalK' ? 'Total Value' : 'Weighted Value'} />
              <Bar dataKey="totalK" radius={[4, 4, 0, 0]} fill="hsl(var(--primary) / 0.3)">
                {formatted.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_COLORS[entry.label] ? `${STAGE_COLORS[entry.label]}40` : 'hsl(var(--primary) / 0.3)'} />
                ))}
              </Bar>
              <Bar dataKey="weightedK" radius={[4, 4, 0, 0]}>
                {formatted.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_COLORS[entry.label] || 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground mt-2 text-center">
            {data.reduce((s, d) => s + d.count, 0)} deals · £{Math.round(data.reduce((s, d) => s + d.totalValue, 0) / 1000)}k total
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function InvoicesByWeekChart({ data }: { data: InvoiceWeek[] }) {
  const hasData = data.some(w => w.due > 0 || w.overdue > 0);
  if (!hasData) return null;

  return (
    <section>
      <SectionHeader icon={BarChart3} title="Invoices Due / Overdue (8 Weeks)" />
      <Card>
        <CardContent className="p-5">
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
        </CardContent>
      </Card>
    </section>
  );
}

function OutreachOutcomesChart({ data }: { data: OutreachOutcomeData }) {
  const hasTargets = data.targetsByState.length > 0;
  const hasCalls = data.callOutcomesByType.length > 0;
  if (!hasTargets && !hasCalls) return null;

  const STATE_COLORS = ['hsl(var(--primary))', 'hsl(142 70% 45%)', 'hsl(40 90% 50%)', 'hsl(0 70% 50%)', 'hsl(var(--muted-foreground))'];

  return (
    <section>
      <SectionHeader icon={Target} title="Outreach Outcomes (30 Days)" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasTargets && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Targets by State</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.targetsByState} layout="vertical" barSize={18}>
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.targetsByState.map((_, i) => (
                      <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {hasCalls && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Call Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.callOutcomesByType} layout="vertical" barSize={18}>
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="outcome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {data.callOutcomesByType.map((_, i) => (
                      <Cell key={i} fill={STATE_COLORS[i % STATE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-8">
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>
              ))}
            </div>
            <Card><CardContent className="p-5"><Skeleton className="h-48" /></CardContent></Card>
            <Card><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>
            <Card><CardContent className="p-5"><Skeleton className="h-48" /></CardContent></Card>
          </div>
          <div>
            <Card><CardContent className="p-5"><Skeleton className="h-64" /></CardContent></Card>
          </div>
        </div>
      </div>
    </div>
  );
}
