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
} from 'lucide-react';
import { useRevenueIntelligence, type CompanyRiskProfile } from '@/hooks/use-revenue-intelligence';

// ── Page ──

const ExecutiveInsights = () => {
  const { data, isLoading } = useRevenueIntelligence();

  if (isLoading) return <FullPageSkeleton />;

  const { companies, atRiskCount, singleThreadedCount, dormantCount, avgRsi, rsiDistribution, pipeline } = data;

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
            />

            {/* §2 Relationship Strength Index */}
            <RelationshipStrengthIndex
              avgRsi={avgRsi}
              distribution={rsiDistribution}
              companies={companies}
            />

            {/* §3 Pipeline Acceleration Signals */}
            <PipelineAcceleration pipeline={pipeline} />

            {/* §4 Org Penetration Heatmap */}
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
}: {
  atRiskCount: number;
  singleThreadedCount: number;
  dormantCount: number;
  companies: CompanyRiskProfile[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-destructive" />
        Revenue Risk Snapshot
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RiskKpiCard
          label="Revenue at Risk"
          value={atRiskCount}
          subtitle={`of ${companies.length} accounts`}
          icon={AlertTriangle}
          severity={atRiskCount > 0 ? 'danger' : 'safe'}
          linkTo="/companies"
        />
        <RiskKpiCard
          label="Single-Threaded"
          value={singleThreadedCount}
          subtitle="≤1 senior contact"
          icon={UserX}
          severity={singleThreadedCount > 0 ? 'warning' : 'safe'}
          linkTo="/companies"
        />
        <RiskKpiCard
          label="Dormant Accounts"
          value={dormantCount}
          subtitle="> 60 days inactive"
          icon={Clock}
          severity={dormantCount > 0 ? 'warning' : 'safe'}
          linkTo="/companies"
        />
      </div>
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
  const total = distribution.high + distribution.medium + distribution.low || 1;
  const highPct = Math.round((distribution.high / total) * 100);
  const medPct = Math.round((distribution.medium / total) * 100);
  const lowPct = Math.round((distribution.low / total) * 100);

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
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-3">Distribution</div>
            <div className="flex gap-3">
              <DistributionBar label="High" count={distribution.high} pct={highPct} color="bg-green-500" />
              <DistributionBar label="Medium" count={distribution.medium} pct={medPct} color="bg-amber-400" />
              <DistributionBar label="Low" count={distribution.low} pct={lowPct} color="bg-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-account RSI list (top 8) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account RSI Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <EmptyState icon={Users} message="No accounts to analyze" action={{ label: 'Add a company', to: '/companies' }} />
          ) : (
            <div className="space-y-2">
              {companies
                .slice()
                .sort((a, b) => a.rsiScore - b.rsiScore) // worst first
                .slice(0, 8)
                .map(c => (
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

function DistributionBar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
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
// §4 — Org Penetration Heatmap
// ════════════════════════════════════════════════════════════

function OrgPenetrationHeatmap({ companies }: { companies: CompanyRiskProfile[] }) {
  const BENCHMARK = 5; // expected minimum contacts

  // Collect all unique departments across portfolio
  const allDepts = [...new Set(companies.flatMap(c => c.departments))].sort();
  const displayDepts = allDepts.slice(0, 8); // cap columns for readability

  if (companies.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Org Penetration
        </h2>
        <Card>
          <CardContent className="py-10">
            <EmptyState icon={Building2} message="No companies to map" action={{ label: 'Add a company', to: '/companies' }} />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Network className="w-5 h-5 text-primary" />
        Org Penetration
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Account</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Contacts</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Senior</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Depts</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Coverage</th>
                  <th className="p-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {companies
                  .slice()
                  .sort((a, b) => a.coveragePercent - b.coveragePercent)
                  .slice(0, 12)
                  .map(c => {
                    const coverageSeverity = c.coveragePercent >= 80 ? 'high' : c.coveragePercent >= 40 ? 'medium' : 'low';
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Link to={`/canvas?company=${c.id}`} className="font-medium hover:text-primary transition-colors">
                            {c.name}
                          </Link>
                        </td>
                        <td className="p-3 text-center tabular-nums">{c.totalContacts}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={`text-xs ${c.seniorContacts === 0 ? 'border-destructive/30 text-destructive' : ''}`}>
                            {c.seniorContacts}
                          </Badge>
                        </td>
                        <td className="p-3 text-center tabular-nums">{c.departments.length}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={c.coveragePercent} className="h-2 w-16" />
                            <span className={`text-xs font-medium tabular-nums ${
                              coverageSeverity === 'high' ? 'text-green-600' :
                              coverageSeverity === 'medium' ? 'text-amber-600' :
                              'text-destructive'
                            }`}>{c.coveragePercent}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Link to={`/canvas?company=${c.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
