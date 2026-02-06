import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface DocumentCount {
  talentId: string;
  totalCount: number;
  hasPrimaryCV: boolean;
}

interface UseCandidateDocumentCountsOptions {
  talentIds?: string[];
  enabled?: boolean;
}

export function useCandidateDocumentCounts({
  talentIds = [],
  enabled = true,
}: UseCandidateDocumentCountsOptions) {
  const { currentWorkspace } = useWorkspace();
  const [counts, setCounts] = useState<Map<string, DocumentCount>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!currentWorkspace?.id || !enabled || talentIds.length === 0) {
      setCounts(new Map());
      return;
    }

    setIsLoading(true);
    try {
      // Fetch document metadata (not file contents) for performance
      const { data, error } = await supabase
        .from('talent_documents')
        .select('talent_id, doc_kind', { count: 'exact' })
        .eq('workspace_id', currentWorkspace.id)
        .in('talent_id', talentIds);

      if (error) {
        console.error('[useCandidateDocumentCounts] Fetch error:', error);
        setCounts(new Map());
        return;
      }

      // Build counts map
      const countsMap = new Map<string, DocumentCount>();
      
      // Initialize all talents with 0 count
      talentIds.forEach(id => {
        countsMap.set(id, { talentId: id, totalCount: 0, hasPrimaryCV: false });
      });

      // Count documents and check for primary CV
      if (data) {
        data.forEach((row: any) => {
          const talentId = row.talent_id;
          const existing = countsMap.get(talentId) || { 
            talentId, 
            totalCount: 0, 
            hasPrimaryCV: false 
          };
          
          existing.totalCount += 1;
          if (row.doc_kind === 'cv') {
            existing.hasPrimaryCV = true;
          }
          
          countsMap.set(talentId, existing);
        });
      }

      setCounts(countsMap);
    } catch (error) {
      console.error('[useCandidateDocumentCounts] Unexpected error:', error);
      setCounts(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, talentIds, enabled]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getCount = useCallback((talentId: string): DocumentCount | undefined => {
    return counts.get(talentId);
  }, [counts]);

  return {
    counts,
    isLoading,
    getCount,
    refetch: fetchCounts,
  };
}
