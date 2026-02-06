import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GeneratedQuestion, GenerateQuestionsResponse } from '@/lib/question-types';

interface UseGeneratedQuestionsOptions {
  talentId?: string;
  jobSpecId?: string;
  workspaceId?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching and generating interview questions
 */
export function useGeneratedQuestions({
  talentId,
  jobSpecId,
  workspaceId,
  enabled = true,
}: UseGeneratedQuestionsOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch cached questions
  const questionsQuery = useQuery({
    queryKey: ['talent-questions', talentId, jobSpecId],
    queryFn: async () => {
      if (!talentId) return null;

      const query = supabase
        .from('talent_questions')
        .select('*')
        .eq('talent_id', talentId);
      
      if (jobSpecId) {
        query.eq('job_spec_id', jobSpecId);
      } else {
        query.is('job_spec_id', null);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        questions: (data.questions as unknown as GeneratedQuestion[]) || [],
      };
    },
    enabled: enabled && !!talentId,
  });

  // Generate questions mutation
  const generateMutation = useMutation({
    mutationFn: async ({ forceRegenerate = false }: { forceRegenerate?: boolean } = {}) => {
      if (!talentId || !workspaceId) {
        throw new Error('Missing talentId or workspaceId');
      }

      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          workspaceId,
          talentId,
          jobSpecId: jobSpecId || undefined,
          forceRegenerate,
        },
      });

      if (error) throw error;
      
      const response = data as GenerateQuestionsResponse;
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate questions');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-questions', talentId, jobSpecId] });
    },
  });

  return {
    questions: questionsQuery.data?.questions || [],
    cachedAt: questionsQuery.data?.updated_at,
    isLoading: questionsQuery.isLoading,
    error: questionsQuery.error,
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
  };
}

export default useGeneratedQuestions;
