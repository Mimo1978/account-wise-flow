import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface JarvisSettings {
  // Voice
  voice_gender: 'male' | 'female';
  voice_style: 'professional' | 'friendly' | 'formal';
  speaking_speed: number;
  volume: number;
  mute_by_default: boolean;

  // ElevenLabs voice selection
  elevenlabs_voice_id: string;
  elevenlabs_voice_name: string;

  // Personalisation
  assistant_name: string;
  greeting_message: string;

  // Behaviour
  auto_sleep_minutes: number;
  keep_listening_default: boolean;
  confirmation_mode: 'always' | 'smart' | 'never';
  show_conversation_history: boolean;

  // Visual effects
  spotlight_enabled: boolean;
}

export const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'British male, natural' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'American male, warm' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'American male, deep' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Strong male' },
] as const;

export const DEFAULT_JARVIS_SETTINGS: JarvisSettings = {
  voice_gender: 'male',
  voice_style: 'professional',
  speaking_speed: 1.0,
  volume: 80,
  mute_by_default: false,
  elevenlabs_voice_id: 'pNInz6obpgDQGcFmaJgB',
  elevenlabs_voice_name: 'Adam',
  assistant_name: 'Jarvis',
  greeting_message: 'Hello {{name}}. I\'m {{assistant}}. How can I help you today?',
  auto_sleep_minutes: 3,
  keep_listening_default: false,
  confirmation_mode: 'always',
  show_conversation_history: true,
  spotlight_enabled: true,
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
