import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { JobSpecMatch, RunMatchResponse } from '@/lib/job-match-types';

export function useJobMatch() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<JobSpecMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runMatch = useCallback(async (jobSpecId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke<RunMatchResponse>('job-match', {
        body: { jobSpecId },
      });

      if (invokeError) throw invokeError;

      if (!data?.success) {
        throw new Error(data?.error || 'Match failed');
      }

      setMatches(data.matches || []);

      toast({
        title: 'Match Complete',
        description: `Found ${data.matchCount} candidates ranked by fit`,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run match';
      setError(message);
      toast({
        title: 'Match Failed',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMatches = useCallback(async (jobSpecId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('job_spec_matches')
        .select(`
          *,
          candidate:candidates(id, name, email, current_title, current_company, location, headline)
        `)
        .eq('job_spec_id', jobSpecId)
        .order('overall_score', { ascending: false });

      if (fetchError) throw fetchError;

      // Type assertion for the joined data
      const typedMatches = (data || []).map(match => ({
        ...match,
        score_breakdown: match.score_breakdown as unknown as JobSpecMatch['score_breakdown'],
        candidate: match.candidate as unknown as JobSpecMatch['candidate'],
      }));

      setMatches(typedMatches);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch matches';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMatches = useCallback(() => {
    setMatches([]);
    setError(null);
  }, []);

  return {
    loading,
    matches,
    error,
    runMatch,
    fetchMatches,
    clearMatches,
  };
}
