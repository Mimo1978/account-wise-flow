import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { JobSpec, CreateJobSpecInput, UpdateJobSpecInput } from '@/lib/job-spec-types';

export function useJobSpecs() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [jobSpecs, setJobSpecs] = useState<JobSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobSpecs = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setJobSpecs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('job_specs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setJobSpecs((data as unknown as JobSpec[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch job specs';
      setError(message);
      console.error('Error fetching job specs:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchJobSpecs();
  }, [fetchJobSpecs]);

  const createJobSpec = async (input: CreateJobSpecInput): Promise<JobSpec | null> => {
    if (!currentWorkspace?.id) {
      toast({
        title: 'Error',
        description: 'No workspace selected',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error: insertError } = await supabase
        .from('job_specs')
        .insert({
          ...input,
          workspace_id: currentWorkspace.id,
          created_by: userData.user?.id,
          key_skills: input.key_skills || [],
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newSpec = data as unknown as JobSpec;
      setJobSpecs(prev => [newSpec, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Job spec created successfully',
      });

      return newSpec;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create job spec';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      console.error('Error creating job spec:', err);
      return null;
    }
  };

  const updateJobSpec = async (input: UpdateJobSpecInput): Promise<JobSpec | null> => {
    try {
      const { id, ...updates } = input;
      
      const { data, error: updateError } = await supabase
        .from('job_specs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedSpec = data as unknown as JobSpec;
      setJobSpecs(prev => prev.map(spec => spec.id === id ? updatedSpec : spec));
      
      toast({
        title: 'Success',
        description: 'Job spec updated successfully',
      });

      return updatedSpec;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update job spec';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      console.error('Error updating job spec:', err);
      return null;
    }
  };

  const deleteJobSpec = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('job_specs')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setJobSpecs(prev => prev.filter(spec => spec.id !== id));
      
      toast({
        title: 'Success',
        description: 'Job spec deleted successfully',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete job spec';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      console.error('Error deleting job spec:', err);
      return false;
    }
  };

  const getJobSpec = async (id: string): Promise<JobSpec | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('job_specs')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      return data as unknown as JobSpec;
    } catch (err) {
      console.error('Error fetching job spec:', err);
      return null;
    }
  };

  return {
    jobSpecs,
    loading,
    error,
    createJobSpec,
    updateJobSpec,
    deleteJobSpec,
    getJobSpec,
    refetch: fetchJobSpecs,
  };
}
