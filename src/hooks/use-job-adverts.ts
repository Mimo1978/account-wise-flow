import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/components/ui/sonner';

export interface BoardFormat {
  id: string;
  workspace_id: string;
  board: string;
  max_words: number | null;
  max_characters: number | null;
  required_sections: string[] | null;
  template: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobAdvert {
  id: string;
  job_id: string;
  workspace_id: string;
  board: string | null;
  content: string | null;
  word_count: number | null;
  character_count: number | null;
  status: string;
  published_at: string | null;
  expires_at: string | null;
  board_job_id: string | null;
  created_at: string;
}

// Default board definitions
export const BOARD_DEFINITIONS: Record<string, { label: string; maxWords: number | null; maxChars: number | null; description: string }> = {
  internal: { label: 'Internal', maxWords: null, maxChars: null, description: 'Client Mapper public job board — full spec, no limits' },
  linkedin: { label: 'LinkedIn', maxWords: null, maxChars: 2000, description: '2000 char limit, narrative style, hashtags at end' },
  jobserve: { label: 'Jobserve', maxWords: 500, maxChars: null, description: '500 word limit, structured sections, formal tone' },
  reed: { label: 'Reed', maxWords: 400, maxChars: null, description: '250-400 words, benefits-led opening, salary explicit' },
  own_site: { label: 'Own Site', maxWords: null, maxChars: null, description: 'Your own format — fully customisable' },
  indeed: { label: 'Indeed', maxWords: 700, maxChars: null, description: '700 word limit, keyword-rich, clear H2 sections' },
};

// ---------- Board Formats ----------
export function useBoardFormats() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['board_formats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('job_board_formats')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);
      if (error) throw error;
      return (data ?? []) as BoardFormat[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useSaveBoardFormat() {
  const qc = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  return useMutation({
    mutationFn: async (payload: { board: string; max_words?: number | null; max_characters?: number | null; required_sections?: string[]; template?: string; notes?: string }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');
      // Upsert — check if exists first
      const { data: existing } = await supabase
        .from('job_board_formats')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('board', payload.board)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('job_board_formats')
          .update({
            max_words: payload.max_words ?? null,
            max_characters: payload.max_characters ?? null,
            required_sections: payload.required_sections ?? null,
            template: payload.template ?? null,
            notes: payload.notes ?? null,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('job_board_formats')
          .insert({
            workspace_id: currentWorkspace.id,
            board: payload.board,
            max_words: payload.max_words ?? null,
            max_characters: payload.max_characters ?? null,
            required_sections: payload.required_sections ?? null,
            template: payload.template ?? null,
            notes: payload.notes ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board_formats'] });
      toast.success('Board format saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Advert mutations ----------
export function useUpdateAdvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const charCount = content.length;
      const { error } = await supabase
        .from('job_adverts')
        .update({ content, word_count: wordCount, character_count: charCount })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_adverts'] });
      toast.success('Advert updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePublishAdvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, board }: { id: string; board: string }) => {
      const newStatus = board === 'internal' ? 'published' : 'ready_to_post';
      const { error } = await supabase
        .from('job_adverts')
        .update({
          status: newStatus,
          published_at: board === 'internal' ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
      return { board, status: newStatus };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['job_adverts'] });
      toast.success(result.board === 'internal' ? 'Published to job board' : 'Marked ready to post — copy the advert text');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Toggle confidential ----------
export function useToggleConfidential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, isConfidential }: { jobId: string; isConfidential: boolean }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ is_confidential: isConfidential } as any)
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Confidentiality updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
