import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBillingPlans, useUpdateBillingPlan, type BillingPlan } from '@/hooks/use-billing-plans';
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

const BILLING_MODE_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  day_rate: 'Day Rate',
  estimate: 'Estimate',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  milestone: 'Milestone',
};

function computeDisplayAmount(plan: BillingPlan): string {
  if (plan.billing_mode === 'fixed' && plan.fixed_amount != null) {
    return `${plan.currency} ${plan.fixed_amount.toLocaleString()}`;
  }
  if (plan.billing_mode === 'day_rate' && plan.day_rate != null) {
    const days = plan.included_days ?? plan.estimated_days ?? 0;
    return `${plan.currency} ${plan.day_rate}/day × ${days} days`;
  }
  if (plan.billing_mode === 'estimate') {
    if (plan.fixed_amount != null) return `${plan.currency} ${plan.fixed_amount.toLocaleString()} (est.)`;
    if (plan.day_rate != null && plan.estimated_days != null) {
      return `${plan.currency} ${plan.day_rate}/day × ${plan.estimated_days} days (est.)`;
    }
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

  const { data: plans = [], isLoading: plansLoading } = useBillingPlans(workspaceId, engagementId);
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices(workspaceId, { company_id: undefined });
  const updatePlan = useUpdateBillingPlan();
  const updateInvoice = useUpdateInvoice();

  const engInvoices = invoices.filter((inv) => inv.engagement_id === engagementId);
  const activePlan = plans.find((p) => p.status === 'active') ?? null;

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setPlanModalOpen(true);
  };

  const handleEditPlan = (plan: BillingPlan) => {
    setEditingPlan(plan);
    setPlanModalOpen(true);
  };

  const handleTogglePause = async (plan: BillingPlan) => {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('billing-run', {
        body: {
          workspace_id: workspaceId,
          mode: 'single_plan',
          billing_plan_id: planId,
        },
      });

      if (error) throw error;

      const result = data as { created_count: number; skipped_count: number; failed_count: number };
      if (result.created_count > 0) {
        toast({ title: `✅ ${result.created_count} invoice(s) created` });
      } else if (result.skipped_count > 0) {
        toast({ title: 'Skipped — invoice already exists for this period', variant: 'default' });
      } else if (result.failed_count > 0) {
        toast({ title: 'Invoice generation failed', variant: 'destructive' });
      } else {
        toast({ title: 'No invoices generated — check plan configuration' });
      }

      // Invalidate to refresh
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
    } catch (err: any) {
      toast({ title: 'Run failed', description: err.message, variant: 'destructive' });
    } finally {
      setRunningNow(false);
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
      {/* Section A: Billing Plan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Billing Plan</h3>
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
                    <h4 className="text-base font-semibold text-foreground">{activePlan.plan_name}</h4>
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
                        <p className="text-sm font-medium text-foreground">{BILLING_MODE_LABELS[activePlan.billing_mode] ?? activePlan.billing_mode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {activePlan.frequency === 'milestone' ? 'Billing' : 'Next Run'}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {activePlan.frequency === 'milestone'
                            ? 'Manual trigger'
                            : activePlan.next_run_date
                              ? format(new Date(activePlan.next_run_date), 'dd MMM yyyy')
                              : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {activePlan.last_run_at && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {format(new Date(activePlan.last_run_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  )}
                </div>

                {canManageBilling && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-xs"
                      onClick={() => handleEditPlan(activePlan)}
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-xs"
                      onClick={() => handleTogglePause(activePlan)}
                      disabled={updatePlan.isPending}
                    >
                      {activePlan.status === 'active' ? (
                        <><Pause className="w-3 h-3" /> Pause</>
                      ) : (
                        <><Play className="w-3 h-3" /> Resume</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 h-8 text-xs"
                      onClick={() => handleRunNow(activePlan.id)}
                      disabled={runningNow || activePlan.status !== 'active'}
                    >
                      {runningNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      {activePlan.frequency === 'milestone' ? 'Create milestone invoice' : 'Run Now'}
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
            <p className="text-sm font-medium text-foreground">No billing plan configured</p>
            <p className="text-xs text-muted-foreground mt-1">Set up automatic invoice generation for this project.</p>
            {canManageBilling && (
              <Button size="sm" className="gap-1.5 mt-4" onClick={handleCreatePlan}>
                <Plus className="w-3.5 h-3.5" />
                Create Billing Plan
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
                    <span className="text-sm font-medium text-foreground">{plan.plan_name}</span>
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
                          {inv.notes && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{inv.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANT[inv.status] ?? 'secondary'} className="text-xs capitalize">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{inv.currency} {inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {inv.issued_date ? format(new Date(inv.issued_date), 'dd MMM') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-7 text-xs"
                              onClick={() => handleMarkStatus(inv.id, 'sent')}
                            >
                              <Send className="w-3 h-3" /> Send
                            </Button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-7 text-xs text-success"
                              onClick={() => handleMarkStatus(inv.id, 'paid')}
                            >
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
        existingPlan={editingPlan}
      />
      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
    </div>
  );
}
