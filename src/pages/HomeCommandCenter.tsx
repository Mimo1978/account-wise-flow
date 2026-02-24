import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
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
} from 'lucide-react';
import { useState } from 'react';

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
  ctas: { label: string; to: string; variant?: 'default' | 'outline' }[];
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 min-h-[220px]">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      <div className="flex items-center gap-2 mt-4">
        {ctas.map((cta) => (
          <Button key={cta.label} variant={cta.variant ?? 'default'} size="sm" asChild>
            <Link to={cta.to} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {cta.label}
            </Link>
          </Button>
        ))}
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

/* ─── Main Page ─── */
const HomeCommandCenter = () => {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);

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
          value="—"
          subtitle="No projects yet"
          icon={Briefcase}
          accentClass="bg-primary"
        />
        <KPICard
          title="Pipeline"
          value="—"
          subtitle="No pipeline data"
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
        </div>
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
              <Button size="sm" variant="outline" asChild>
                <Link to="/companies" className="gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Add Company
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
              <PipelineStage label="Prospect" count={0} />
              <PipelineStage label="Contacted" count={0} />
              <PipelineStage label="Qualified" count={0} />
              <PipelineStage label="Proposal" count={0} />
              <PipelineStage label="Closed" count={0} />
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
    </div>
  );
};

export default HomeCommandCenter;
