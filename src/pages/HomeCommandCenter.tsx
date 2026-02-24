import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { CreateEngagementModal } from '@/components/home/CreateEngagementModal';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Briefcase,
  TrendingUp,
  FileText,
  CalendarClock,
  Plus,
  Building2,
  ArrowRight,
  Megaphone,
  Users,
  LayoutGrid,
  Clock,
  Receipt,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

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
  onAction,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  ctas: { label: string; to?: string; onClick?: () => void; variant?: 'default' | 'outline' }[];
  onAction?: () => void;
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

/* ─── Main Page ─── */
const HomeCommandCenter = () => {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: engagements = [], isLoading: engLoading } = useEngagements(currentWorkspace?.id);

  const activeCount = engagements.filter((e) => e.stage === 'active').length;
  const pipelineCount = engagements.filter((e) => e.stage === 'pipeline').length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshWorkspaces();
    setTimeout(() => setRefreshing(false), 600);
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
          title="Pipeline"
          value={pipelineCount > 0 ? String(pipelineCount) : '—'}
          subtitle={pipelineCount > 0 ? `${pipelineCount} in pipeline` : 'No pipeline data'}
          icon={TrendingUp}
          accentClass="bg-accent"
        />
        <KPICard
          title="Outstanding Invoices"
          value="—"
          subtitle="No invoices"
          icon={FileText}
          accentClass="bg-warning"
        />
        <KPICard
          title="Renewals & Key Dates"
          value="—"
          subtitle="Nothing upcoming"
          icon={CalendarClock}
          accentClass="bg-success"
        />
      </div>

      {/* ── My Work + Diary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">My Work</h2>
            <Badge variant="secondary" className="text-xs">0 items</Badge>
          </div>
          <EmptyPanel
            title="No tasks assigned"
            description="Tasks, follow-ups and actions assigned to you will appear here."
            icon={Clock}
            ctas={[
              { label: 'View Outreach', to: '/outreach', variant: 'outline' },
              { label: 'View Talent', to: '/talent', variant: 'outline' },
            ]}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Diary</h2>
            <Badge variant="secondary" className="text-xs">Today</Badge>
          </div>
          <EmptyPanel
            title="No events today"
            description="Scheduled calls, meetings and deadlines will appear in your diary."
            icon={CalendarClock}
            ctas={[
              { label: 'View Outreach', to: '/outreach', variant: 'outline' },
            ]}
          />
        </div>
      </div>

      {/* ── Active Projects Table ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Projects</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
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
                    <tr key={eng.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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

      {/* ── Pipeline Snapshot ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pipeline Snapshot</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/outreach" className="gap-1.5 text-xs text-muted-foreground">
              View full pipeline
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 overflow-x-auto">
              <PipelineStage label="Pipeline" count={engagements.filter((e) => e.stage === 'pipeline').length} />
              <PipelineStage label="Active" count={activeCount} />
              <PipelineStage label="On Hold" count={engagements.filter((e) => e.stage === 'on_hold').length} />
              <PipelineStage label="Closed Won" count={engagements.filter((e) => e.stage === 'closed_won').length} />
              <PipelineStage label="Closed Lost" count={engagements.filter((e) => e.stage === 'closed_lost').length} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Billing Snapshot ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Billing Snapshot</h2>
        </div>
        <EmptyPanel
          title="No invoices yet"
          description="Track outstanding invoices, payments and billing milestones here."
          icon={Receipt}
          ctas={[
            { label: 'View Companies', to: '/companies', variant: 'outline' },
          ]}
        />
      </section>

      {/* ── Create Engagement Modal ── */}
      <CreateEngagementModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default HomeCommandCenter;
