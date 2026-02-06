import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { 
  CVExportRequest, 
  CVPreviewData, 
  GeneratedExport,
  TemplateStyle 
} from '@/lib/cv-export-types';
import type { Talent } from '@/lib/types';
import type { JobSpec } from '@/lib/job-spec-types';

export function useCVExport() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  /**
   * Generate an AI executive summary for the candidate aligned to a job spec
   */
  const generateExecutiveSummary = useCallback(async (
    candidate: Talent,
    jobSpec?: JobSpec
  ): Promise<string> => {
    if (!currentWorkspace?.id) {
      throw new Error('No workspace selected');
    }

    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('cv-summary-generate', {
        body: {
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateTitle: candidate.roleType,
          candidateSkills: candidate.skills,
          candidateExperience: candidate.experience,
          candidateHeadline: candidate.aiOverview,
          jobSpecTitle: jobSpec?.title,
          jobSpecSkills: jobSpec?.key_skills,
          jobSpecDescription: jobSpec?.description_text,
        },
      });

      if (error) throw error;

      return data?.summary || '';
    } catch (err) {
      console.error('Error generating summary:', err);
      // Return a basic fallback summary
      return `${candidate.name} is a ${candidate.roleType} with expertise in ${candidate.skills.slice(0, 5).join(', ')}.`;
    } finally {
      setGeneratingSummary(false);
    }
  }, [currentWorkspace?.id]);

  /**
   * Generate and export the CV as PDF
   */
  const exportCV = useCallback(async (
    request: CVExportRequest,
    previewData: CVPreviewData
  ): Promise<GeneratedExport | null> => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cv-export-pdf', {
        body: {
          workspaceId: currentWorkspace.id,
          candidateId: request.candidateId,
          jobSpecId: request.jobSpecId,
          templateStyle: request.templateStyle,
          includeSections: request.includeSections,
          executiveSummary: request.executiveSummary,
          previewData,
        },
      });

      if (error) throw error;

      toast.success('CV exported successfully');
      return data?.export as GeneratedExport;
    } catch (err) {
      console.error('Error exporting CV:', err);
      toast.error('Failed to export CV');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  /**
   * Get download URL for an exported CV
   */
  const getExportUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('generated-exports')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting export URL:', err);
      return null;
    }
  }, []);

  /**
   * Fetch previous exports for a candidate
   */
  const getCandidateExports = useCallback(async (candidateId: string): Promise<GeneratedExport[]> => {
    if (!currentWorkspace?.id) return [];

    try {
      const { data, error } = await supabase
        .from('generated_exports')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as GeneratedExport[]) || [];
    } catch (err) {
      console.error('Error fetching exports:', err);
      return [];
    }
  }, [currentWorkspace?.id]);

  return {
    loading,
    generatingSummary,
    generateExecutiveSummary,
    exportCV,
    getExportUrl,
    getCandidateExports,
  };
}
