import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface JarvisSettings {
  // Voice
  voice_gender: 'male' | 'female';
  voice_style: 'professional' | 'friendly' | 'formal';
  speaking_speed: number; // 0.7 = slow, 1.0 = normal, 1.3 = fast
  volume: number; // 0-100
  mute_by_default: boolean;

  // Personalisation
  assistant_name: string;
  greeting_message: string;

  // Behaviour
  auto_sleep_minutes: number; // 1, 3, 5, 0 = never
  keep_listening_default: boolean;
  confirmation_mode: 'always' | 'smart' | 'never';
  show_conversation_history: boolean;
}

export const DEFAULT_JARVIS_SETTINGS: JarvisSettings = {
  voice_gender: 'male',
  voice_style: 'professional',
  speaking_speed: 1.0,
  volume: 80,
  mute_by_default: false,
  assistant_name: 'Jarvis',
  greeting_message: 'Hello {{name}}. I\'m {{assistant}}. How can I help you today?',
  auto_sleep_minutes: 3,
  keep_listening_default: false,
  confirmation_mode: 'always',
  show_conversation_history: true,
};

export function useJarvisSettings() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['jarvis-settings', currentWorkspace?.id],
    queryFn: async (): Promise<JarvisSettings> => {
      if (!user || !currentWorkspace) return DEFAULT_JARVIS_SETTINGS;

      const { data, error } = await supabase
        .from('workspace_settings')
        .select('jarvis_settings')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error || !data) return DEFAULT_JARVIS_SETTINGS;

      const raw = (data as any).jarvis_settings;
      if (!raw || Object.keys(raw).length === 0) return DEFAULT_JARVIS_SETTINGS;

      return { ...DEFAULT_JARVIS_SETTINGS, ...raw } as JarvisSettings;
    },
    enabled: !!user && !!currentWorkspace,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: JarvisSettings) => {
      if (!currentWorkspace) throw new Error('No workspace');

      // Check if settings row exists
      const { data: existing } = await supabase
        .from('workspace_settings')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('workspace_settings')
          .update({ jarvis_settings: updates as any })
          .eq('workspace_id', currentWorkspace.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workspace_settings')
          .insert({
            workspace_id: currentWorkspace.id,
            jarvis_settings: updates as any,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jarvis-settings', currentWorkspace?.id] });
      toast.success('Jarvis settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  return {
    settings: settings ?? DEFAULT_JARVIS_SETTINGS,
    isLoading,
    saveSettings: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
