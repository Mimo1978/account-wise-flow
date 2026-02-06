// CV Export Types

export type TemplateStyle = 'classic' | 'modern' | 'compact';

export interface CVTemplateSettings {
  style: TemplateStyle;
  maxPages: 4;
  includeSections: {
    education: boolean;
    certifications: boolean;
    projects: boolean;
    skills: boolean;
    experience: boolean;
  };
}

export interface WorkspaceBranding {
  id: string;
  workspace_id: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedExport {
  id: string;
  workspace_id: string;
  candidate_id: string;
  job_spec_id: string | null;
  template_style: TemplateStyle;
  storage_path: string;
  file_type: 'pdf' | 'docx';
  executive_summary: string | null;
  included_sections: string[];
  created_by: string | null;
  created_at: string;
}

export interface CVExportRequest {
  candidateId: string;
  jobSpecId?: string;
  templateStyle: TemplateStyle;
  includeSections: string[];
  executiveSummary: string;
}

export interface CVPreviewData {
  candidate: {
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    currentTitle: string | null;
    headline: string | null;
    skills: string[];
    experience: Array<{
      company: string;
      title: string;
      startDate: string;
      endDate?: string;
      current?: boolean;
      description?: string;
    }>;
    education: Array<{
      institution: string;
      degree: string;
      field?: string;
      year?: string;
    }>;
    certifications?: string[];
  };
  executiveSummary: string;
  branding: WorkspaceBranding | null;
  templateStyle: TemplateStyle;
  jobSpec?: {
    title: string;
    company?: string;
  };
}

export const TEMPLATE_STYLES: { value: TemplateStyle; label: string; description: string }[] = [
  { 
    value: 'classic', 
    label: 'Classic', 
    description: 'Professional consulting style with clean typography' 
  },
  { 
    value: 'modern', 
    label: 'Modern', 
    description: 'Contemporary tech-focused layout with accent colors' 
  },
  { 
    value: 'compact', 
    label: 'Compact', 
    description: 'Space-efficient 2-page style for dense experience' 
  },
];

export const DEFAULT_SECTIONS = {
  experience: true,
  skills: true,
  education: true,
  certifications: false,
  projects: false,
};
