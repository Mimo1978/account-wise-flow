import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useInvoicePlans, useUpdateInvoicePlan, type InvoicePlan } from '@/hooks/use-invoice-plans';
import { useInvoices, useUpdateInvoice, type Invoice } from '@/hooks/use-invoices';
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from '@/integrations/supabase/client';
import { BillingPlanModal } from '@/components/home/BillingPlanModal';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import {
  Plus,
  Receipt,
  Play,
  Pause,
  Edit2,
  Zap,
  Loader2,
  CalendarClock,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  Send,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'outline',
  overdue: 'destructive',
  void: 'secondary',
};

const AMOUNT_MODE_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  days_x_rate: 'Day Rate',
  timesheet_estimate: 'Estimate',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  custom: 'Custom',
};

function computeDisplayAmount(plan: InvoicePlan): string {
  if (plan.amount_mode === 'fixed' && plan.fixed_amount != null) {
    return `${plan.currency} ${plan.fixed_amount.toLocaleString()}`;
  }
  if ((plan.amount_mode === 'days_x_rate' || plan.amount_mode === 'timesheet_estimate') && plan.rate_per_day != null) {
    const days = plan.estimated_days ?? 0;
    return `${plan.currency} ${plan.rate_per_day}/day × ${days} days`;
  }
  return '—';
}

interface ProjectBillingTabProps {
  engagementId: string;
  companyId: string;
  workspaceId: string;
}

export function ProjectBillingTab({ engagementId, companyId, workspaceId }: ProjectBillingTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = usePermissions();
  const canManageBilling = isAdmin || isManager;

  const { data: plans = [], isLoading: plansLoading } = useInvoicePlans(workspaceId, engagementId);
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices(workspaceId);
  const updatePlan = useUpdateInvoicePlan();
  const updateInvoice = useUpdateInvoice();

  const engInvoices = invoices.filter((inv) => inv.engagement_id === engagementId);
  const activePlan = plans.find((p) => p.status === 'active') ?? null;

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InvoicePlan | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setPlanModalOpen(true);
  };

  const handleEditPlan = (plan: InvoicePlan) => {
    setEditingPlan(plan);
    setPlanModalOpen(true);
  };

  const handleTogglePause = async (plan: InvoicePlan) => {
    const newStatus = plan.status === 'active' ? 'paused' : 'active';
    try {
      await updatePlan.mutateAsync({ id: plan.id, status: newStatus });
      toast({ title: `Plan ${newStatus === 'active' ? 'resumed' : 'paused'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRunNow = async (planId: string) => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-run-due-plans', {
        body: {
          workspace_id: workspaceId,
          mode: 'execute',
          plan_id: planId,
        },
      });

      if (error) throw error;

      const created = data?.invoices_created ?? 0;
      const skipped = data?.invoices_skipped ?? 0;
      if (created > 0) {
        toast({ title: `✅ ${created} invoice(s) created` });
      } else if (skipped > 0) {
        toast({ title: 'Skipped — invoice already exists for this period' });
      } else {
        toast({ title: 'No invoices generated — check plan configuration' });
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-plans'] });
    } catch (err: any) {
      toast({ title: 'Run failed', description: err.message, variant: 'destructive' });
    } finally {
      setRunningNow(false);
    }
  };

  const handleGeneratePdf = async (invoiceId: string) => {
    setGeneratingPdf(invoiceId);
    try {
      const { data, error } = await supabase.functions.invoke('invoice-generate-pdf', {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
        toast({ title: 'PDF generated successfully' });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast({ title: 'PDF generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleMarkStatus = async (invoiceId: string, status: string) => {
    try {
      const updates: Record<string, any> = { status };
      if (status === 'paid') updates.paid_date = new Date().toISOString().slice(0, 10);
      await updateInvoice.mutateAsync({ id: invoiceId, ...updates });
      toast({ title: `Invoice marked as ${status}` });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const isLoading = plansLoading || invoicesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Invoice Plan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Invoice Plan</h3>
          {!activePlan && canManageBilling && (
            <Button size="sm" className="gap-1.5" onClick={handleCreatePlan}>
              <Plus className="w-3.5 h-3.5" />
              Create Plan
            </Button>
          )}
        </div>

        {activePlan ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-foreground">{activePlan.name}</h4>
                    <Badge variant={activePlan.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">
                      {activePlan.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {activePlan.plan_type.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
                        <p className="text-sm font-medium text-foreground">{computeDisplayAmount(activePlan)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Frequency</p>
                        <p className="text-sm font-medium text-foreground">{FREQUENCY_LABELS[activePlan.frequency] ?? activePlan.frequency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Mode</p>
                        <p className="text-sm font-medium text-foreground">{AMOUNT_MODE_LABELS[activePlan.amount_mode] ?? activePlan.amount_mode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Next Run</p>
                        <p className="text-sm font-medium text-foreground">
                          {activePlan.next_run_date
                            ? format(new Date(activePlan.next_run_date), 'dd MMM yyyy')
                            : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {canManageBilling && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => handleEditPlan(activePlan)}>
                      <Edit2 className="w-3 h-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => handleTogglePause(activePlan)} disabled={updatePlan.isPending}>
                      {activePlan.status === 'active' ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                    </Button>
                    <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => handleRunNow(activePlan.id)} disabled={runningNow || activePlan.status !== 'active'}>
                      {runningNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      Run Now
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <CalendarClock className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">No invoice plan configured</p>
            <p className="text-xs text-muted-foreground mt-1">Set up automatic invoice generation for this project.</p>
            {canManageBilling && (
              <Button size="sm" className="gap-1.5 mt-4" onClick={handleCreatePlan}>
                <Plus className="w-3.5 h-3.5" /> Create Invoice Plan
              </Button>
            )}
          </Card>
        )}

        {/* Show paused/ended plans */}
        {plans.filter((p) => p.status !== 'active').length > 0 && (
          <div className="mt-3 space-y-2">
            {plans.filter((p) => p.status !== 'active').map((plan) => (
              <Card key={plan.id} className="p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{plan.name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{plan.status}</Badge>
                  </div>
                  {canManageBilling && plan.status === 'paused' && (
                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => handleTogglePause(plan)}>
                      <Play className="w-3 h-3" /> Resume
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section B: Invoices for this Project */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Invoices ({engInvoices.length})
          </h3>
          <Button size="sm" className="gap-1.5" onClick={() => setInvoiceOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Create Invoice
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {engInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-foreground">{inv.invoice_number || '#' + inv.id.slice(0, 6)}</span>
                          {inv.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{inv.notes}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANT[inv.status] ?? 'secondary'} className="text-xs capitalize">{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {inv.currency} {inv.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {inv.issued_date ? format(new Date(inv.issued_date), 'dd MMM') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 h-7 text-xs"
                            onClick={() => handleGeneratePdf(inv.id)}
                            disabled={generatingPdf === inv.id}
                          >
                            {generatingPdf === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                            PDF
                          </Button>
                          {inv.status === 'draft' && (
                            <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => handleMarkStatus(inv.id, 'sent')}>
                              <Send className="w-3 h-3" /> Send
                            </Button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-success" onClick={() => handleMarkStatus(inv.id, 'paid')}>
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      <BillingPlanModal
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
        workspaceId={workspaceId}
        engagementId={engagementId}
        companyId={companyId}
        existingPlan={editingPlan as any}
      />
      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
    </div>
  );
}
