import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { useSows, type Sow } from '@/hooks/use-sows';
import { CreateEngagementModal } from '@/components/home/CreateEngagementModal';
import { CreateSowModal } from '@/components/home/CreateSowModal';
import { SowDetailSheet } from '@/components/home/SowDetailSheet';
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
  LayoutGrid,
  Clock,
  Receipt,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, differenceInDays, addDays, isAfter, isBefore, isToday, startOfDay } from 'date-fns';

/* ─── Types ─── */
interface CriticalDateItem {
  id: string;
  type: 'renewal' | 'end';
  date: Date;
  label: string;
  companyName: string;
  sowRef: string | null;
  sow: Sow;
  overdue: boolean;
  daysUntil: number;
}

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
  ctas: { label: string; to?: string; onClick?: () => void; variant?: 'default' | 'outline' }[];
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

/* ─── Critical Date Row ─── */
function CriticalDateRow({ item, onClick }: { item: CriticalDateItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg group"
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.overdue ? 'bg-destructive/10' : 'bg-warning/10'}`}>
        {item.overdue ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <CalendarClock className="w-4 h-4 text-warning" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {item.type === 'renewal' ? 'Renewal' : 'Contract End'} — {item.companyName}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.sowRef ? `${item.sowRef} · ` : ''}
          {item.overdue
            ? `${Math.abs(item.daysUntil)}d overdue`
            : item.daysUntil === 0
            ? 'Today'
            : `in ${item.daysUntil}d`}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{format(item.date, 'dd MMM')}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
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

/* ─── Helpers ─── */
function buildCriticalDates(sows: Sow[], windowDays: number): CriticalDateItem[] {
  const today = startOfDay(new Date());
  const cutoff = addDays(today, windowDays);
  const items: CriticalDateItem[] = [];

  for (const sow of sows) {
    if (sow.status === 'expired') continue;

    const companyName = sow.companies?.name ?? 'Unknown';

    if (sow.renewal_date) {
      const d = startOfDay(new Date(sow.renewal_date));
      const diff = differenceInDays(d, today);
      if (diff <= windowDays) {
        items.push({
          id: `${sow.id}-renewal`,
          type: 'renewal',
          date: d,
          label: `Renewal — ${companyName}`,
          companyName,
          sowRef: sow.sow_ref,
          sow,
          overdue: isBefore(d, today),
          daysUntil: diff,
        });
      }
    }

    if (sow.end_date) {
      const d = startOfDay(new Date(sow.end_date));
      const diff = differenceInDays(d, today);
      if (diff <= windowDays) {
        items.push({
          id: `${sow.id}-end`,
          type: 'end',
          date: d,
          label: `End — ${companyName}`,
          companyName,
          sowRef: sow.sow_ref,
          sow,
          overdue: isBefore(d, today),
          daysUntil: diff,
        });
      }
    }
  }

  // Sort: overdue first, then by date ascending
  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  });

  return items;
}

/* ─── Main Page ─── */
const HomeCommandCenter = () => {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [sowOpen, setSowOpen] = useState(false);
  const [selectedSow, setSelectedSow] = useState<Sow | null>(null);
  const [sowSheetOpen, setSowSheetOpen] = useState(false);

  const { data: engagements = [], isLoading: engLoading } = useEngagements(currentWorkspace?.id);
  const { data: sows = [], isLoading: sowsLoading } = useSows(currentWorkspace?.id);

  const activeCount = engagements.filter((e) => e.stage === 'active').length;
  const pipelineCount = engagements.filter((e) => e.stage === 'pipeline').length;

  // Critical dates: My Work = 30 days, Diary = 7 days
  const myWorkItems = useMemo(() => buildCriticalDates(sows, 30), [sows]);
  const diaryItems = useMemo(() => buildCriticalDates(sows, 7), [sows]);

  const renewalCount = myWorkItems.length;
  const overdueCount = myWorkItems.filter((i) => i.overdue).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshWorkspaces();
    setTimeout(() => setRefreshing(false), 600);
  };

  const openSowDetail = (sow: Sow) => {
    setSelectedSow(sow);
    setSowSheetOpen(true);
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
          title="Active SOWs"
          value={sows.filter((s) => s.status === 'signed').length > 0 ? String(sows.filter((s) => s.status === 'signed').length) : '—'}
          subtitle={sows.length > 0 ? `${sows.length} total contracts` : 'No contracts'}
          icon={FileText}
          accentClass="bg-warning"
        />
        <KPICard
          title="Renewals & Key Dates"
          value={renewalCount > 0 ? String(renewalCount) : '—'}
          subtitle={overdueCount > 0 ? `${overdueCount} overdue` : renewalCount > 0 ? `${renewalCount} upcoming` : 'Nothing upcoming'}
          icon={CalendarClock}
          accentClass="bg-success"
        />
      </div>

      {/* ── My Work + Diary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Work: 30 day window */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">My Work</h2>
            <Badge variant="secondary" className="text-xs">{myWorkItems.length} items</Badge>
          </div>
          {myWorkItems.length === 0 ? (
            <EmptyPanel
              title="No tasks or critical dates"
              description="Upcoming renewals, contract end dates and overdue items will appear here."
              icon={Clock}
              ctas={[
                { label: 'Add SOW', onClick: () => setSowOpen(true) },
                { label: 'View Outreach', to: '/outreach', variant: 'outline' },
              ]}
            />
          ) : (
            <Card className="divide-y divide-border/50">
              {myWorkItems.slice(0, 8).map((item) => (
                <CriticalDateRow
                  key={item.id}
                  item={item}
                  onClick={() => openSowDetail(item.sow)}
                />
              ))}
              {myWorkItems.length > 8 && (
                <div className="px-4 py-2 text-center">
                  <span className="text-xs text-muted-foreground">+{myWorkItems.length - 8} more items</span>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Diary: 7 day window */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Diary</h2>
            <Badge variant="secondary" className="text-xs">Next 7 days</Badge>
          </div>
          {diaryItems.length === 0 ? (
            <EmptyPanel
              title="No events this week"
              description="Contract renewals and end dates in the next 7 days will appear in your diary."
              icon={CalendarClock}
              ctas={[
                { label: 'Add SOW', onClick: () => setSowOpen(true) },
              ]}
            />
          ) : (
            <Card className="divide-y divide-border/50">
              {diaryItems.slice(0, 6).map((item) => (
                <CriticalDateRow
                  key={item.id}
                  item={item}
                  onClick={() => openSowDetail(item.sow)}
                />
              ))}
              {diaryItems.length > 6 && (
                <div className="px-4 py-2 text-center">
                  <span className="text-xs text-muted-foreground">+{diaryItems.length - 6} more</span>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ── SOWs & Renewals ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">SOWs & Contracts</h2>
          <Button size="sm" className="gap-1.5" onClick={() => setSowOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add SOW
          </Button>
        </div>

        {sowsLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : sows.length === 0 ? (
          <EmptyPanel
            title="No SOWs or contracts"
            description="Add statements of work to track renewals, billing and contract health."
            icon={FileText}
            ctas={[
              { label: 'Add SOW', onClick: () => setSowOpen(true) },
              { label: 'View Companies', to: '/companies', variant: 'outline' },
            ]}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {sows.map((sow) => (
                    <tr
                      key={sow.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openSowDetail(sow)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{sow.sow_ref || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sow.companies?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={sow.status === 'signed' ? 'default' : sow.status === 'expired' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                          {sow.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">{sow.billing_model.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sow.value > 0 ? `${sow.currency} ${sow.value.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {sow.end_date ? format(new Date(sow.end_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {sow.renewal_date ? format(new Date(sow.renewal_date), 'dd MMM yyyy') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

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

      {/* ── Modals ── */}
      <CreateEngagementModal open={createOpen} onOpenChange={setCreateOpen} />
      <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
      <SowDetailSheet sow={selectedSow} open={sowSheetOpen} onOpenChange={setSowSheetOpen} />
    </div>
  );
};

export default HomeCommandCenter;
