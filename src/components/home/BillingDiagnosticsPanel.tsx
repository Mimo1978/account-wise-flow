import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { useBillingPlans, useUpdateBillingPlan } from '@/hooks/use-billing-plans';
import { useInvoices } from '@/hooks/use-invoices';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Bug, Zap, Database } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';

export function BillingDiagnosticsPanel() {
  const isDev = import.meta.env.DEV;

  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();

  const { data: engagements = [] } = useEngagements(workspaceId);
  const { data: plans = [] } = useBillingPlans(workspaceId);
  const { data: invoices = [] } = useInvoices(workspaceId);
  const updatePlan = useUpdateBillingPlan();

  const [simulating, setSimulating] = useState(false);

  const activePlans = plans.filter(p => p.status === 'active');
  const pausedPlans = plans.filter(p => p.status === 'paused');

  const thirtyDaysAgo = subDays(startOfDay(new Date()), 30).toISOString();
  const recentInvoices = invoices.filter(inv => inv.created_at >= thirtyDaysAgo);

  // Fetch last 10 invoice_runs
  const { data: recentRuns = [], isLoading: runsLoading } = useQuery({
    queryKey: ['billing-diagnostics-runs', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('invoice_runs' as any)
        .select('id, status, period_start, period_end, dedupe_key, error_message, created_at, billing_plan_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!workspaceId,
  });

  const handleSimulateDueRun = async () => {
    const target = activePlans[0];
    if (!target || !workspaceId) {
      toast.error('No active plan to simulate');
      return;
    }

    setSimulating(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await updatePlan.mutateAsync({ id: target.id, next_run_date: todayStr });

      const { data, error } = await supabase.functions.invoke('billing-run', {
        body: { workspace_id: workspaceId, mode: 'single_plan', billing_plan_id: target.id },
      });
      if (error) throw error;

      toast.success(`Simulate done: ${data?.created_count ?? 0} created, ${data?.skipped_count ?? 0} skipped`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-diagnostics-runs'] });
    } catch (e: any) {
      toast.error(e.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  if (!isDev) return null;

  const STATUS_COLOR: Record<string, string> = {
    created: 'text-success',
    skipped: 'text-muted-foreground',
    failed: 'text-destructive',
  };

  return (
    <section className="border-2 border-dashed border-orange-400/50 rounded-lg p-1">
      <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-300/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm text-orange-700 dark:text-orange-400">
              Billing Diagnostics (DEV only)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-background rounded-md p-3 text-center border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Engagements</p>
              <p className="text-lg font-bold text-foreground">{engagements.length}</p>
            </div>
            <div className="bg-background rounded-md p-3 text-center border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Plans</p>
              <p className="text-lg font-bold text-foreground">{activePlans.length}</p>
              {pausedPlans.length > 0 && (
                <p className="text-[10px] text-muted-foreground">+{pausedPlans.length} paused</p>
              )}
            </div>
            <div className="bg-background rounded-md p-3 text-center border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices (30d)</p>
              <p className="text-lg font-bold text-foreground">{recentInvoices.length}</p>
            </div>
            <div className="bg-background rounded-md p-3 text-center border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Plans</p>
              <p className="text-lg font-bold text-foreground">{plans.length}</p>
            </div>
          </div>

          {/* Invoice Runs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Invoice Runs</p>
              <Badge variant="outline" className="text-[10px]">{recentRuns.length} shown</Badge>
            </div>
            {runsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No invoice runs yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Period</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Created</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run: any) => (
                      <tr key={run.id} className="border-b border-border/30">
                        <td className="px-2 py-1.5">
                          <span className={`font-medium capitalize ${STATUS_COLOR[run.status] ?? ''}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {run.period_start} → {run.period_end}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {format(new Date(run.created_at), 'dd MMM HH:mm')}
                        </td>
                        <td className="px-2 py-1.5 text-destructive truncate max-w-[150px]">
                          {run.error_message || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Simulate button */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-orange-300 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/40"
              onClick={handleSimulateDueRun}
              disabled={simulating || activePlans.length === 0}
            >
              {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Simulate Due Run
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Sets next_run_date=today on first active plan, then runs billing-run
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
