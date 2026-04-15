import type { MatchEvidence } from './evidence-types';

export interface MatchScoreBreakdown {
  overall_score: number;
  skill_match_score: number;
  sector_company_score: number;
  tenure_score: number;
  recency_score: number;
  matched_skills?: string[];
  missing_skills?: string[];
  sector_match?: string;
  tenure_analysis?: {
    average_tenure_months: number;
    recent_role_tenure_months: number;
    short_tenure_roles: number;
    inferred_role_type?: 'contractor' | 'permanent' | 'mixed' | 'unknown';
    role_type_notes?: string[];
  };
  recency_analysis?: {
    years_since_relevant_role: number;
    has_recent_experience: boolean;
  };
  /** Structured evidence linking claims to CV snippets */
  evidence?: MatchEvidence;
}

export interface JobSpecMatch {
  id: string;
  job_spec_id: string;
  talent_id: string;
  workspace_id: string;
  overall_score: number;
  skill_match_score: number;
  sector_company_score: number;
  tenure_score: number;
  recency_score: number;
  score_breakdown: MatchScoreBreakdown;
  risk_flags: string[];
  suggested_questions: string[];
  top_evidence_snippets: string[];
  match_reasoning: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined data
  candidate?: {
    id: string;
    name: string;
    email: string | null;
    current_title: string | null;
    current_company: string | null;
    location: string | null;
    headline: string | null;
  };
}

export interface RunMatchRequest {
  jobSpecId: string;
}

export interface RunMatchResponse {
  success: boolean;
  matchCount: number;
  matches: JobSpecMatch[];
  error?: string;
}
