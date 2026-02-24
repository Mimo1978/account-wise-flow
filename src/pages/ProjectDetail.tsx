import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagement } from '@/hooks/use-engagements';
import { useSows } from '@/hooks/use-sows';
import { useInvoices } from '@/hooks/use-invoices';
import { CreateSowModal } from '@/components/home/CreateSowModal';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
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
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';

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

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data: engagement, isLoading } = useEngagement(id, currentWorkspace?.id);

  // Fetch SOWs & invoices for this engagement
  const { data: allSows = [] } = useSows(currentWorkspace?.id);
  const { data: allInvoices = [] } = useInvoices(currentWorkspace?.id);

  const [sowOpen, setSowOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

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
      <Tabs defaultValue="overview" className="space-y-4">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Invoices</h3>
            <Button size="sm" className="gap-1.5" onClick={() => setInvoiceOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create Invoice
            </Button>
          </div>
          {engInvoices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center text-center p-8">
              <Receipt className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No invoices linked to this project yet.</p>
              <Button size="sm" className="gap-1.5 mt-3" onClick={() => setInvoiceOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Create Invoice
              </Button>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE_VARIANT[inv.status] ?? 'secondary'} className="text-xs capitalize">{inv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.currency} {inv.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach">
          <Card className="flex flex-col items-center justify-center text-center p-8">
            <Megaphone className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Outreach campaigns are managed at the workspace level.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 mt-3" asChild>
              <Link to="/outreach">Open Outreach</Link>
            </Button>
          </Card>
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
