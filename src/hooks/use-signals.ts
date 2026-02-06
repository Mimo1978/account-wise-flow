import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TalentSignal, JobMatchSignal, SignalType, SignalSeverity } from '@/lib/signal-types';
import type { EvidenceSnippet } from '@/lib/evidence-types';

interface UseSignalsOptions {
  talentId?: string;
  workspaceId?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching and managing talent signals
 */
export function useSignals({ talentId, workspaceId, enabled = true }: UseSignalsOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch signals for a talent
  const signalsQuery = useQuery({
    queryKey: ['talent-signals', talentId],
    queryFn: async () => {
      if (!talentId) return [];

      const { data, error } = await supabase
        .from('talent_signals')
        .select('*')
        .eq('talent_id', talentId)
        .eq('is_dismissed', false)
        .order('severity', { ascending: false });

      if (error) throw error;
      
      // Transform DB response to TalentSignal type
      return (data || []).map(row => ({
        ...row,
        signal_type: row.signal_type as SignalType,
        severity: row.severity as SignalSeverity,
        evidence: (row.evidence as unknown as EvidenceSnippet[]) || [],
      })) as TalentSignal[];
    },
    enabled: enabled && !!talentId,
  });

  // Dismiss a signal
  const dismissMutation = useMutation({
    mutationFn: async (signalId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('talent_signals')
        .update({
          is_dismissed: true,
          dismissed_by: user.id,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', signalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-signals', talentId] });
    },
  });

  // Calculate summary stats
  const signalCount = signalsQuery.data?.length || 0;
  const maxSeverity: SignalSeverity = signalsQuery.data?.reduce((max, s) => {
    const order: SignalSeverity[] = ['low', 'med', 'high'];
    return order.indexOf(s.severity) > order.indexOf(max) ? s.severity : max;
  }, 'low' as SignalSeverity) || 'low';

  return {
    signals: signalsQuery.data || [],
    signalCount,
    maxSeverity,
    isLoading: signalsQuery.isLoading,
    error: signalsQuery.error,
    dismissSignal: dismissMutation.mutate,
    isDismissing: dismissMutation.isPending,
  };
}

/**
 * Extract signals from job match score_breakdown
 */
export function extractMatchSignals(scoreBreakdown: Record<string, unknown> | null): JobMatchSignal[] {
  if (!scoreBreakdown) return [];
  
  const signals: JobMatchSignal[] = [];
  const evidence = scoreBreakdown.evidence as { claims?: unknown[] } | undefined;
  
  // Extract risk claims as signals
  if (evidence?.claims) {
    const claims = evidence.claims as Array<{
      id: string;
      text: string;
      category: string;
      evidence?: EvidenceSnippet[];
    }>;
    
    for (const claim of claims) {
      if (claim.category === 'risk') {
        signals.push({
          id: claim.id,
          signal_type: inferSignalType(claim.text),
          severity: inferSeverity(claim.text),
          title: extractTitle(claim.text),
          description: claim.text,
          evidence: claim.evidence || [],
        });
      }
    }
  }

  // Extract from risk_flags if present in breakdown (legacy format)
  const riskFlags = scoreBreakdown.risk_flags as string[] | undefined;
  if (riskFlags && Array.isArray(riskFlags)) {
    for (let i = 0; i < riskFlags.length; i++) {
      const flag = riskFlags[i];
      signals.push({
        id: `legacy-risk-${i}`,
        signal_type: inferSignalType(flag),
        severity: inferSeverity(flag),
        title: extractTitle(flag),
        description: flag,
        evidence: [],
      });
    }
  }

  return signals;
}

/**
 * Infer signal type from text content
 */
function inferSignalType(text: string): SignalType {
  const lower = text.toLowerCase();
  
  if (lower.includes('short tenure') || lower.includes('months') && lower.includes('role')) {
    return 'short_tenure';
  }
  if (lower.includes('gap') || lower.includes('unexplained')) {
    return 'unexplained_gap';
  }
  if (lower.includes('mismatch') || lower.includes('junior') || lower.includes('senior')) {
    return 'role_mismatch';
  }
  if (lower.includes('pattern') || lower.includes('multiple') || lower.includes('hopping')) {
    return 'contract_hopping';
  }
  if (lower.includes('skill') || lower.includes('missing')) {
    return 'skill_gap';
  }
  if (lower.includes('recent') || lower.includes('dated')) {
    return 'recency_concern';
  }
  
  return 'short_tenure'; // Default
}

/**
 * Infer severity from text content
 */
function inferSeverity(text: string): SignalSeverity {
  const lower = text.toLowerCase();
  
  if (lower.includes('pattern') || lower.includes('multiple') || lower.includes('no recent')) {
    return 'high';
  }
  if (lower.includes('short tenure') || lower.includes('gap')) {
    return 'med';
  }
  
  return 'low';
}

/**
 * Extract a short title from description
 */
function extractTitle(text: string): string {
  // Take first clause or limit to ~40 chars
  const firstClause = text.split(/[,\-\:]/).at(0)?.trim() || text;
  if (firstClause.length <= 40) return firstClause;
  return firstClause.substring(0, 37) + '...';
}

export default useSignals;
