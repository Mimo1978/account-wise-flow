import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagement } from '@/hooks/use-engagements';
import { useSows } from '@/hooks/use-sows';
import { useInvoices } from '@/hooks/use-invoices';
import {
  useOutreachCampaigns,
  useOutreachTargets,
  useLinkCampaignToEngagement,
  useUnlinkCampaignFromEngagement,
  type OutreachCampaign,
  type OutreachTarget,
} from '@/hooks/use-outreach';
import { CreateSowModal } from '@/components/home/CreateSowModal';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import { ProjectBillingTab } from '@/components/home/ProjectBillingTab';
import { CreateCampaignModal } from '@/components/outreach/CreateCampaignModal';
import { AddTargetsModal } from '@/components/outreach/AddTargetsModal';
import { OutreachTargetRow } from '@/components/outreach/OutreachTargetRow';
import { TargetDetailSheet } from '@/components/outreach/TargetDetailSheet';
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Plus,
  FileText,
  Receipt,
  Megaphone,
  FolderOpen,
  Calendar,
  LinkIcon,
  Users,
  ExternalLink,
  Unlink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline',
  active: 'Active',
  on_hold: 'On Hold',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-success text-success-foreground',
  amber: 'bg-warning text-warning-foreground',
  red: 'bg-destructive text-destructive-foreground',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'outline',
  overdue: 'destructive',
  void: 'secondary',
  signed: 'default',
  expired: 'destructive',
};

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  archived: 'bg-muted text-muted-foreground',
};

/* ─── Link Existing Campaign Modal ─── */
function LinkCampaignModal({
  open,
  onOpenChange,
  engagementId,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagementId: string;
  campaigns: OutreachCampaign[];
}) {
  const { mutateAsync, isPending } = useLinkCampaignToEngagement();
  const unlinked = campaigns.filter((c) => !c.engagement_id);
  const [search, setSearch] = useState('');

  const filtered = unlinked.filter((c) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async (campaignId: string) => {
    await mutateAsync({ campaignId, engagementId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Existing Campaign</DialogTitle>
        </DialogHeader>
        {unlinked.length === 0 ? (
          <div className="py-8 text-center">
            <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">All campaigns are already linked to projects.</p>
          </div>
        ) : (
          <>
            {unlinked.length > 5 && (
              <input
                type="text"
                placeholder="Search campaigns..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <ScrollArea className="max-h-72">
              <div className="space-y-2 p-1">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLink(c.id)}
                    disabled={isPending}
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <Badge className={`text-[10px] capitalize ${CAMPAIGN_STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.target_count} targets · {c.channel}
                    </p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No matching campaigns.</p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campaign Card (expandable with targets) ─── */
function CampaignCard({
  campaign,
  engagementId,
  onOpenInOutreach,
}: {
  campaign: OutreachCampaign;
  engagementId: string;
  onOpenInOutreach: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { mutateAsync: unlinkCampaign, isPending: unlinking } = useUnlinkCampaignFromEngagement();
  const [expanded, setExpanded] = useState(false);
  const [addTargetsOpen, setAddTargetsOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<OutreachTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: targets = [] } = useOutreachTargets(
    expanded ? { campaignId: campaign.id } : {}
  );

  const contacted = targets.filter((t) => t.state !== 'queued').length;
  const booked = targets.filter((t) => t.state === 'booked' || t.state === 'converted').length;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
                <Badge className={`text-[10px] capitalize ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}>
                  {campaign.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{campaign.channel}</Badge>
              </div>
              {campaign.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                onClick={() => onOpenInOutreach(campaign.id)}
              >
                <ExternalLink className="w-3 h-3" />
                Open in Outreach
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-7 text-muted-foreground hover:text-destructive"
                onClick={() => unlinkCampaign(campaign.id)}
                disabled={unlinking}
                title="Unlink campaign from project"
              >
                <Unlink className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/40">
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.target_count}</p>
              <p className="text-[10px] text-muted-foreground">Targets</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.contacted_count}</p>
              <p className="text-[10px] text-muted-foreground">Contacted</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.response_count}</p>
              <p className="text-[10px] text-muted-foreground">Responses</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">
                {campaign.target_count > 0 ? Math.round((campaign.response_count / campaign.target_count) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground">Conversion</p>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide' : 'Show'} Targets
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Expanded targets section */}
        {expanded && (
          <div className="border-t border-border/40 bg-muted/10 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Targets</p>
              <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setAddTargetsOpen(true)}>
                <Users className="w-3 h-3" />
                Add Targets
              </Button>
            </div>
            {targets.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No targets yet. Add candidates or contacts.</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/30">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium">Name</TableHead>
                      <TableHead className="text-xs font-medium">State</TableHead>
                      <TableHead className="text-xs font-medium hidden lg:table-cell">Last Contact</TableHead>
                      <TableHead className="text-xs font-medium w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <OutreachTargetRow
                        key={target.id}
                        target={target}
                        onOpen={(t) => {
                          setSelectedTarget(t);
                          setDetailOpen(true);
                        }}
                        selected={false}
                        onSelectChange={() => {}}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>

      <AddTargetsModal
        open={addTargetsOpen}
        onOpenChange={setAddTargetsOpen}
        campaignId={campaign.id}
      />
      <TargetDetailSheet
        target={selectedTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

/* ─── Project Outreach Tab ─── */
function ProjectOutreachTab({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: linkedCampaigns = [], isLoading } = useOutreachCampaigns(engagementId);
  const { data: allCampaigns = [] } = useOutreachCampaigns();

  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Campaigns ({linkedCampaigns.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkOpen(true)}>
            <LinkIcon className="w-3.5 h-3.5" />
            Link Existing
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Campaign list or empty state */}
      {linkedCampaigns.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center p-10">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Outreach Campaigns</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create or link outreach campaigns to manage targets, scripts, and actions directly from this project.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create Campaign
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkOpen(true)}>
              <LinkIcon className="w-3.5 h-3.5" />
              Link Existing
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {linkedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              engagementId={engagementId}
              onOpenInOutreach={(cId) => navigate(`/outreach?campaignId=${cId}&fromProject=${engagementId}`)}
            />
          ))}
        </div>
      )}

      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        engagementId={engagementId}
      />
      <LinkCampaignModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        engagementId={engagementId}
        campaigns={allCampaigns}
      />
    </>
  );
}

/* ─── Main Component ─── */
const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';
  const { currentWorkspace } = useWorkspace();
  const { data: engagement, isLoading } = useEngagement(id, currentWorkspace?.id);

  // Fetch SOWs & invoices for this engagement
  const { data: allSows = [] } = useSows(currentWorkspace?.id);
  const { data: allInvoices = [] } = useInvoices(currentWorkspace?.id);

  const [sowOpen, setSowOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false); // kept for legacy/contracts use

  const engSows = useMemo(() => {
    if (!engagement) return [];
    return allSows.filter(
      (s) => s.engagement_id === engagement.id || (!s.engagement_id && s.company_id === engagement.company_id)
    );
  }, [allSows, engagement]);

  const engInvoices = useMemo(() => {
    if (!engagement) return [];
    return allInvoices.filter((inv) => inv.engagement_id === engagement.id);
  }, [allInvoices, engagement]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="container mx-auto px-6 py-16 max-w-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
          <Briefcase className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Project not found</h2>
        <p className="text-sm text-muted-foreground">This project may have been deleted or you don't have access.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/projects')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4" />
            Projects
          </Button>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{engagement.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">{engagement.engagement_type.replace('_', ' ')}</Badge>
            <Badge variant="outline" className="text-xs">{STAGE_LABELS[engagement.stage] ?? engagement.stage}</Badge>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[engagement.health]?.split(' ')[0] ?? 'bg-muted'}`} />
            {engagement.companies?.name && (
              <span className="text-sm text-muted-foreground">· {engagement.companies.name}</span>
            )}
            <span className="text-xs text-muted-foreground">· Updated {format(new Date(engagement.updated_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stage</CardTitle></CardHeader>
              <CardContent><Badge variant="outline">{STAGE_LABELS[engagement.stage] ?? engagement.stage}</Badge></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Forecast Value</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-foreground">
                  {engagement.forecast_value > 0 ? `${engagement.currency} ${engagement.forecast_value.toLocaleString()}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Dates</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Start: {engagement.start_date ? format(new Date(engagement.start_date), 'dd MMM yyyy') : '—'}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  End: {engagement.end_date ? format(new Date(engagement.end_date), 'dd MMM yyyy') : '—'}
                </p>
              </CardContent>
            </Card>
          </div>
          {engagement.description && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{engagement.description}</p></CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contracts</p>
              <p className="text-xl font-bold text-foreground mt-1">{engSows.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoices</p>
              <p className="text-xl font-bold text-foreground mt-1">{engInvoices.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Billed</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {engInvoices.length > 0
                  ? `£${engInvoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}`
                  : '—'}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract Value</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {engSows.length > 0
                  ? `£${engSows.reduce((s, sw) => s + sw.value, 0).toLocaleString()}`
                  : '—'}
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">SOWs & Contracts</h3>
            <Button size="sm" className="gap-1.5" onClick={() => setSowOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add SOW
            </Button>
          </div>
          {engSows.length === 0 ? (
            <Card className="flex flex-col items-center justify-center text-center p-8">
              <FileText className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No contracts linked to this project yet.</p>
              <Button size="sm" className="gap-1.5 mt-3" onClick={() => setSowOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add SOW
              </Button>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Renewal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engSows.map((sow) => (
                      <tr key={sow.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{sow.sow_ref || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE_VARIANT[sow.status] ?? 'secondary'} className="text-xs capitalize">{sow.status}</Badge>
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
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <ProjectBillingTab
            engagementId={engagement.id}
            companyId={engagement.company_id ?? ''}
            workspaceId={currentWorkspace?.id ?? ''}
          />
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach">
          <ProjectOutreachTab engagementId={engagement.id} />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card className="flex flex-col items-center justify-center text-center p-8">
            <FolderOpen className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Files coming next</p>
            <p className="text-xs text-muted-foreground mt-1">Project file management will be available in a future update.</p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
    </div>
  );
};

export default ProjectDetail;
