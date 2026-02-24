import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';

export interface OutreachMetrics {
  queued: number;
  contacted: number;
  responded: number;
  booked: number;
  totalTargets: number;
  responseRate: number; // responded / contacted-pool
  bookingRate: number;  // booked / contacted-pool
  callOutcomesLast7: Record<string, number>;
  /** Outreach targets with upcoming next_action_due/next_action_at within windowDays */
  upcomingActions: OutreachActionItem[];
  /** Call outcomes with follow_up_due within windowDays */
  upcomingFollowUps: OutreachActionItem[];
}

export interface OutreachActionItem {
  id: string;
  date: Date;
  label: string;
  entityName: string;
  source: 'outreach_target' | 'call_followup';
  overdue: boolean;
  daysUntil: number;
}

export function useOutreachMetrics(workspaceId: string | undefined, windowDays = 30) {
  return useQuery({
    queryKey: ['outreach-metrics', workspaceId, windowDays],
    queryFn: async (): Promise<OutreachMetrics> => {
      if (!workspaceId) return emptyMetrics();

      const today = startOfDay(new Date());
      const sevenDaysAgo = subDays(today, 7);

      // Fetch targets and call outcomes in parallel
      const [targetsRes, callsRes] = await Promise.all([
        supabase
          .from('outreach_targets')
          .select('id, state, entity_name, next_action, next_action_due, next_action_at')
          .eq('workspace_id', workspaceId),
        supabase
          .from('call_outcomes')
          .select('id, outcome, called_at, follow_up_action, follow_up_due, notes')
          .eq('workspace_id', workspaceId)
          .gte('called_at', sevenDaysAgo.toISOString()),
      ]);

      if (targetsRes.error) throw targetsRes.error;
      if (callsRes.error) throw callsRes.error;

      const targets = targetsRes.data ?? [];
      const calls = callsRes.data ?? [];

      // State counts
      const stateCounts: Record<string, number> = {};
      for (const t of targets) {
        stateCounts[t.state] = (stateCounts[t.state] || 0) + 1;
      }

      const queued = stateCounts['queued'] || 0;
      const contacted = stateCounts['contacted'] || 0;
      const responded = stateCounts['responded'] || 0;
      const booked = stateCounts['booked'] || 0;

      // Contacted pool = contacted + responded + booked + converted
      const contactedPool = contacted + responded + booked + (stateCounts['converted'] || 0);
      const responseRate = contactedPool > 0 ? responded / contactedPool : 0;
      const bookingRate = contactedPool > 0 ? booked / contactedPool : 0;

      // Call outcomes grouped by outcome
      const callOutcomesLast7: Record<string, number> = {};
      for (const c of calls) {
        callOutcomesLast7[c.outcome] = (callOutcomesLast7[c.outcome] || 0) + 1;
      }

      // Upcoming outreach target actions
      const upcomingActions: OutreachActionItem[] = [];
      for (const t of targets) {
        const dateStr = t.next_action_due || t.next_action_at;
        if (!dateStr) continue;
        const d = startOfDay(new Date(dateStr));
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (diff <= windowDays) {
          upcomingActions.push({
            id: `ot-${t.id}`,
            date: d,
            label: t.next_action || 'Follow up',
            entityName: t.entity_name,
            source: 'outreach_target',
            overdue: diff < 0,
            daysUntil: diff,
          });
        }
      }

      // Upcoming call follow-ups (fetch all with follow_up_due, not just last 7 days)
      const followUpRes = await supabase
        .from('call_outcomes')
        .select('id, follow_up_action, follow_up_due, notes')
        .eq('workspace_id', workspaceId)
        .not('follow_up_due', 'is', null);

      const upcomingFollowUps: OutreachActionItem[] = [];
      if (!followUpRes.error && followUpRes.data) {
        for (const c of followUpRes.data) {
          if (!c.follow_up_due) continue;
          const d = startOfDay(new Date(c.follow_up_due));
          const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
          if (diff <= windowDays) {
            upcomingFollowUps.push({
              id: `cf-${c.id}`,
              date: d,
              label: c.follow_up_action || 'Call follow-up',
              entityName: c.notes?.slice(0, 30) || 'Follow-up',
              source: 'call_followup',
              overdue: diff < 0,
              daysUntil: diff,
            });
          }
        }
      }

      return {
        queued,
        contacted,
        responded,
        booked,
        totalTargets: targets.length,
        responseRate,
        bookingRate,
        callOutcomesLast7,
        upcomingActions,
        upcomingFollowUps,
      };
    },
    enabled: !!workspaceId,
  });
}

function emptyMetrics(): OutreachMetrics {
  return {
    queued: 0,
    contacted: 0,
    responded: 0,
    booked: 0,
    totalTargets: 0,
    responseRate: 0,
    bookingRate: 0,
    callOutcomesLast7: {},
    upcomingActions: [],
    upcomingFollowUps: [],
  };
}
