import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  ShieldAlert,
  Target,
  BarChart3,
  Timer,
} from 'lucide-react';
import { useRevenueIntelligence, type CompanyRiskProfile, type RevenueIntelligenceData, type SalesMomentum } from '@/hooks/use-revenue-intelligence';

// ── Page ──

const ExecutiveInsights = () => {
  const { data, isLoading } = useRevenueIntelligence();

  if (isLoading) return <FullPageSkeleton />;

  const { companies, atRiskCount, singleThreadedCount, dormantCount, avgRsi, rsiDistribution, pipeline, salesMomentum, riskSummary } = data;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Revenue Intelligence</h1>
          <p className="text-muted-foreground">
            Portfolio health, pipeline signals, and relationship strength — all from live data
          </p>
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
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-destructive" />
        Revenue Risk Snapshot
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
  const styles = {
    danger: 'border-destructive/30 bg-destructive/5',
    warning: 'border-amber-300/50 bg-amber-50/30',
    safe: 'border-green-300/50 bg-green-50/30',
  };
  const iconBg = {
    danger: 'bg-destructive/10 text-destructive',
    warning: 'bg-amber-100 text-amber-600',
    safe: 'bg-green-100 text-green-600',
  };

  return (
    <Link to={linkTo}>
      <Card className={`${styles[severity]} hover:shadow-md transition-shadow cursor-pointer`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2.5 rounded-lg ${iconBg[severity]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold mb-0.5">{value}</div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
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
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Relationship Strength Index
      </h2>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {/* Average RSI */}
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-1">Average RSI</div>
            <div className="text-3xl font-bold">{avgRsi}</div>
            <Progress value={avgRsi} className="mt-2 h-2" />
            <div className="text-xs text-muted-foreground mt-2">
              Base 100 · −20 no exec · −15 single dept · −10 no activity 45d · +10 &gt;3 contacts · +10 response &gt;25%
            </div>
          </CardContent>
        </Card>

        {/* Distribution — clickable bars */}
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-3">Distribution (click to filter)</div>
            <div className="flex gap-3">
              <DistributionBar label="High (70+)" count={distribution.high} pct={highPct} color="bg-green-500" active={bandFilter === 'high'} onClick={() => setBandFilter(f => f === 'high' ? 'all' : 'high')} />
              <DistributionBar label="Medium (40–69)" count={distribution.medium} pct={medPct} color="bg-amber-400" active={bandFilter === 'medium'} onClick={() => setBandFilter(f => f === 'medium' ? 'all' : 'medium')} />
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
            <EmptyState icon={Users} message={bandFilter !== 'all' ? `No ${bandFilter} RSI accounts` : 'No accounts to analyze'} action={{ label: 'Add a company', to: '/companies' }} />
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
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Rocket className="w-5 h-5 text-primary" />
        Pipeline Acceleration Signals
      </h2>

      {!hasSignals ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={Zap} message="No pipeline signals yet" action={{ label: 'Create a campaign', to: '/outreach' }} />
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
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <div className="text-2xl font-bold">{value}</div>
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
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        Sales Momentum
      </h2>

      {!hasData ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={BarChart3} message="No outreach data yet" action={{ label: 'Create a campaign', to: '/outreach' }} />
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
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Follow-Up Delay</span>
                </div>
                <div className="text-2xl font-bold">
                  {avgFollowUpDelayDays !== null ? `${avgFollowUpDelayDays}d` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">called_at → follow_up_due</div>
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
    <Card className={meetsThreshold ? 'border-green-200/60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{detail}</div>
        <div className={`text-xs mt-1 ${meetsThreshold ? 'text-green-600' : 'text-muted-foreground'}`}>
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
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Org Penetration Analytics
        </h2>
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={Building2} message="No companies to analyse" action={{ label: 'Add a company', to: '/companies' }} />
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Org Penetration Analytics
        </h2>
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
    <div className="lg:sticky lg:top-8 space-y-4">
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

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: React.ElementType;
  message: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="text-center text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
      {action && (
        <Link to={action.to}>
          <Button variant="link" size="sm" className="mt-1">{action.label}</Button>
        </Link>
      )}
    </div>
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
