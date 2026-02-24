import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, subWeeks, format, isAfter, isBefore, parseISO, addDays } from 'date-fns';

export interface PipelineByStage {
  stage: string;
  label: string;
  totalValue: number;
  weightedValue: number;
  count: number;
}

export interface InvoiceWeek {
  weekLabel: string;
  due: number;
  overdue: number;
}

export interface OutreachOutcomeData {
  targetsByState: { state: string; count: number }[];
  callOutcomesByType: { outcome: string; count: number }[];
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export function useAnalyticsCharts(workspaceId: string | undefined) {
  // 1. Pipeline by stage
  const pipelineQuery = useQuery({
    queryKey: ['analytics-pipeline-stage', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('stage, value, probability')
        .eq('workspace_id', workspaceId);
      if (error) throw error;

      const stageMap = new Map<string, PipelineByStage>();
      for (const d of data || []) {
        const entry = stageMap.get(d.stage) || {
          stage: d.stage,
          label: STAGE_LABELS[d.stage] || d.stage,
          totalValue: 0,
          weightedValue: 0,
          count: 0,
        };
        entry.totalValue += d.value || 0;
        entry.weightedValue += (d.value || 0) * ((d.probability || 0) / 100);
        entry.count += 1;
        stageMap.set(d.stage, entry);
      }

      const order = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
      return order
        .filter(s => stageMap.has(s))
        .map(s => stageMap.get(s)!);
    },
    enabled: !!workspaceId,
  });

  // 2. Invoices due/overdue by week (last 8 weeks)
  const invoicesQuery = useQuery({
    queryKey: ['analytics-invoices-weekly', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('due_date, status, paid_date')
        .eq('workspace_id', workspaceId)
        .in('status', ['sent', 'overdue'])
        .is('paid_date', null);
      if (error) throw error;

      const now = new Date();
      const weeks: InvoiceWeek[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 7);
        const label = format(weekStart, 'dd MMM');
        let due = 0;
        let overdue = 0;
        for (const inv of data || []) {
          if (!inv.due_date) continue;
          const dd = parseISO(inv.due_date);
          if (isAfter(dd, weekStart) && isBefore(dd, weekEnd)) {
            if (inv.status === 'overdue' || isBefore(dd, now)) {
              overdue++;
            } else {
              due++;
            }
          }
        }
        weeks.push({ weekLabel: label, due, overdue });
      }
      return weeks;
    },
    enabled: !!workspaceId,
  });

  // 3. Outreach outcomes (last 30 days)
  const outreachQuery = useQuery({
    queryKey: ['analytics-outreach-outcomes', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { targetsByState: [], callOutcomesByType: [] } as OutreachOutcomeData;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [targetsRes, outcomesRes] = await Promise.all([
        supabase
          .from('outreach_targets')
          .select('state')
          .eq('workspace_id', workspaceId),
        supabase
          .from('call_outcomes')
          .select('outcome')
          .eq('workspace_id', workspaceId)
          .gte('called_at', thirtyDaysAgo),
      ]);

      // Targets by state
      const stateMap = new Map<string, number>();
      for (const t of targetsRes.data || []) {
        stateMap.set(t.state, (stateMap.get(t.state) || 0) + 1);
      }
      const targetsByState = Array.from(stateMap.entries())
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count);

      // Call outcomes by type
      const outcomeMap = new Map<string, number>();
      for (const o of outcomesRes.data || []) {
        outcomeMap.set(o.outcome, (outcomeMap.get(o.outcome) || 0) + 1);
      }
      const callOutcomesByType = Array.from(outcomeMap.entries())
        .map(([outcome, count]) => ({ outcome, count }))
        .sort((a, b) => b.count - a.count);

      return { targetsByState, callOutcomesByType } as OutreachOutcomeData;
    },
    enabled: !!workspaceId,
  });

  return {
    pipelineByStage: pipelineQuery.data || [],
    invoiceWeeks: invoicesQuery.data || [],
    outreachOutcomes: outreachQuery.data || { targetsByState: [], callOutcomesByType: [] },
    isLoading: pipelineQuery.isLoading || invoicesQuery.isLoading || outreachQuery.isLoading,
  };
}
