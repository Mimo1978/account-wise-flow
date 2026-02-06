export type JobSpecType = 'permanent' | 'contract';

export interface JobSpec {
  id: string;
  workspace_id: string;
  title: string;
  client_company_id: string | null;
  sector: string | null;
  location: string | null;
  type: JobSpecType;
  day_rate_range: string | null;
  salary_range: string | null;
  description_text: string | null;
  key_skills: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobSpecInput {
  title: string;
  client_company_id?: string | null;
  sector?: string;
  location?: string;
  type: JobSpecType;
  day_rate_range?: string;
  salary_range?: string;
  description_text?: string;
  key_skills?: string[];
}

export interface UpdateJobSpecInput extends Partial<CreateJobSpecInput> {
  id: string;
}
