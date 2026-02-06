import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { WorkspaceBranding } from '@/lib/cv-export-types';

export function useWorkspaceBranding() {
  const { currentWorkspace } = useWorkspace();
  const [branding, setBranding] = useState<WorkspaceBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setBranding(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspace_branding')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (error) throw error;
      setBranding(data as unknown as WorkspaceBranding | null);
    } catch (err) {
      console.error('Error fetching workspace branding:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!currentWorkspace?.id) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentWorkspace.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-branding')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('workspace-branding')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast.error('Failed to upload logo');
      return null;
    }
  };

  const updateBranding = async (updates: Partial<WorkspaceBranding>): Promise<boolean> => {
    if (!currentWorkspace?.id) return false;

    try {
      if (branding) {
        // Update existing
        const { error } = await supabase
          .from('workspace_branding')
          .update(updates)
          .eq('workspace_id', currentWorkspace.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('workspace_branding')
          .insert({
            workspace_id: currentWorkspace.id,
            ...updates,
          });

        if (error) throw error;
      }

      await fetchBranding();
      toast.success('Branding updated');
      return true;
    } catch (err) {
      console.error('Error updating branding:', err);
      toast.error('Failed to update branding');
      return false;
    }
  };

  const getLogoUrl = (): string | null => {
    if (!branding?.logo_path) return null;
    return branding.logo_path;
  };

  return {
    branding,
    loading,
    uploadLogo,
    updateBranding,
    getLogoUrl,
    refetch: fetchBranding,
  };
}
