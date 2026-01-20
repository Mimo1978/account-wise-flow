// Executive Insights Hooks - Logic layer for future UI integration
// These hooks provide the data access layer for the Executive Insights dashboard

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  ExecutiveInsight,
  RiskSignal,
  RelationshipCoverage,
  ExecutiveQueryResponse,
  ExecutiveQuery,
  UseExecutiveInsightsResult,
  UseRiskSignalsResult,
  UseCoverageResult,
  UseExecutiveQueryResult,
} from '@/lib/executive-insights-types';

/**
 * Hook to fetch and manage executive insights
 */
export function useExecutiveInsights(workspaceId?: string): UseExecutiveInsightsResult {
  const [insights, setInsights] = useState<ExecutiveInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    if (!workspaceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('executive_insights')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_dismissed', false)
        .order('severity', { ascending: true }) // critical first
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setInsights((data as ExecutiveInsight[]) || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch insights');
      setError(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  const dismissInsight = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('executive_insights')
        .update({ 
          is_dismissed: true, 
          dismissed_at: new Date().toISOString(),
          // dismissed_by will be set by RLS context
        })
        .eq('id', id);

      if (updateError) throw updateError;
      
      setInsights(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Insight dismissed' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to dismiss insight' });
    }
  }, [toast]);

  return { insights, loading, error, refetch, dismissInsight };
}

/**
 * Hook to fetch and manage risk signals
 */
export function useRiskSignals(workspaceId?: string): UseRiskSignalsResult {
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    if (!workspaceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('risk_signals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_resolved', false)
        .order('risk_level', { ascending: true }) // critical first
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setSignals((data as RiskSignal[]) || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch risk signals');
      setError(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  const resolveSignal = useCallback(async (id: string, notes?: string) => {
    try {
      const { error: updateError } = await supabase
        .from('risk_signals')
        .update({ 
          is_resolved: true, 
          resolved_at: new Date().toISOString(),
          resolution_notes: notes || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;
      
      setSignals(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Risk signal resolved' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to resolve signal' });
    }
  }, [toast]);

  return { signals, loading, error, refetch, resolveSignal };
}

/**
 * Hook to fetch relationship coverage data
 */
export function useCoverage(workspaceId?: string): UseCoverageResult {
  const [coverage, setCoverage] = useState<RelationshipCoverage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    if (!workspaceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('relationship_coverage')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('coverage_score', { ascending: true }) // lowest coverage first
        .limit(200);

      if (fetchError) throw fetchError;
      setCoverage((data as RelationshipCoverage[]) || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch coverage data');
      setError(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  const getCompanyCoverage = useCallback((companyId: string) => {
    return coverage.find(c => c.company_id === companyId && !c.department);
  }, [coverage]);

  return { coverage, loading, error, refetch, getCompanyCoverage };
}

/**
 * Hook to query the executive insights AI
 */
export function useExecutiveQuery(workspaceId?: string): UseExecutiveQueryResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [history, setHistory] = useState<ExecutiveQuery[]>([]);
  const { toast } = useToast();

  const query = useCallback(async (
    question: string,
    options?: { companyId?: string; includeAllCompanies?: boolean }
  ): Promise<ExecutiveQueryResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('executive-insights', {
        body: { 
          query: question, 
          companyId: options?.companyId,
          includeAllCompanies: options?.includeAllCompanies ?? true,
        },
      });

      if (fnError) throw fnError;
      
      // Refresh history after successful query
      if (workspaceId) {
        fetchHistory(workspaceId);
      }
      
      return data as ExecutiveQueryResponse;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process query');
      setError(error);
      
      // Handle specific error codes
      if (error.message.includes('429') || error.message.includes('Rate limit')) {
        toast({ variant: 'destructive', title: 'Rate Limited', description: 'Please wait a moment before asking another question.' });
      } else if (error.message.includes('402') || error.message.includes('Payment')) {
        toast({ variant: 'destructive', title: 'Credits Required', description: 'Please add credits to your workspace.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  const fetchHistory = useCallback(async (wsId: string) => {
    try {
      const { data } = await supabase
        .from('executive_queries')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Map database response to our type, handling nullable fields
      const mapped: ExecutiveQuery[] = (data || []).map((q: Record<string, unknown>) => ({
        id: q.id as string,
        workspace_id: q.workspace_id as string,
        user_id: q.user_id as string,
        query_text: q.query_text as string,
        query_type: q.query_type as ExecutiveQuery['query_type'],
        response_summary: q.response_summary as string | undefined,
        response_data: q.response_data as ExecutiveQueryResponse | undefined,
        feedback_rating: q.feedback_rating as number | undefined,
        created_at: q.created_at as string,
      }));
      setHistory(mapped);
    } catch {
      // Silently fail for history fetch
    }
  }, []);

  const rateQuery = useCallback(async (queryId: string, rating: number) => {
    try {
      const { error: updateError } = await supabase
        .from('executive_queries')
        .update({ feedback_rating: rating })
        .eq('id', queryId);

      if (updateError) throw updateError;
      
      setHistory(prev => prev.map(q => 
        q.id === queryId ? { ...q, feedback_rating: rating } : q
      ));
      
      toast({ title: 'Feedback recorded', description: 'Thank you for your feedback!' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save feedback' });
    }
  }, [toast]);

  return { query, loading, error, history, rateQuery };
}

/**
 * Utility function to calculate coverage score
 * Can be used for client-side calculations before server sync
 */
export function calculateCoverageScore(contacts: {
  status?: string;
  seniority?: string;
  role?: string;
  lastContact?: string;
}[]): number {
  if (contacts.length === 0) return 0;
  
  let score = 0;
  const now = new Date();
  
  contacts.forEach(contact => {
    // Base points for having a contact
    score += 10;
    
    // Points for engagement status
    if (contact.status === 'champion') score += 25;
    else if (contact.status === 'engaged') score += 15;
    else if (contact.status === 'warm') score += 10;
    
    // Points for seniority
    if (contact.seniority === 'executive') score += 20;
    else if (contact.seniority === 'director') score += 15;
    else if (contact.seniority === 'manager') score += 10;
    
    // Points for having a defined role
    if (contact.role === 'economic-buyer') score += 20;
    else if (contact.role === 'champion') score += 15;
    else if (contact.role) score += 5;
    
    // Points for recent contact
    if (contact.lastContact) {
      const lastDate = new Date(contact.lastContact);
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) score += 15;
      else if (daysSince <= 30) score += 10;
      else if (daysSince <= 90) score += 5;
    }
  });
  
  // Normalize to 0-100 scale
  const maxPossibleScore = contacts.length * 90; // Max per contact
  return Math.min(100, Math.round((score / maxPossibleScore) * 100));
}

/**
 * Utility function to identify coverage gaps
 */
export function identifyCoverageGaps(contacts: {
  department?: string;
  seniority?: string;
  role?: string;
  status?: string;
}[]): {
  missingRoles: string[];
  underrepresentedDepartments: string[];
  noChampion: boolean;
  noExecutive: boolean;
} {
  const departments = new Set(contacts.map(c => c.department).filter(Boolean));
  const roles = new Set(contacts.map(c => c.role).filter(Boolean));
  const seniorities = new Set(contacts.map(c => c.seniority).filter(Boolean));
  const statuses = new Set(contacts.map(c => c.status).filter(Boolean));
  
  const essentialRoles = ['economic-buyer', 'champion', 'technical-evaluator'];
  const missingRoles = essentialRoles.filter(role => !roles.has(role));
  
  // Departments with only 1 contact
  const deptCounts: Record<string, number> = {};
  contacts.forEach(c => {
    if (c.department) {
      deptCounts[c.department] = (deptCounts[c.department] || 0) + 1;
    }
  });
  const underrepresentedDepartments = Object.entries(deptCounts)
    .filter(([_, count]) => count === 1)
    .map(([dept]) => dept);
  
  return {
    missingRoles,
    underrepresentedDepartments,
    noChampion: !statuses.has('champion'),
    noExecutive: !seniorities.has('executive'),
  };
}
