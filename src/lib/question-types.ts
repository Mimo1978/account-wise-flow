/**
 * Types for AI-generated interview questions
 */

import type { EvidenceSnippet } from './evidence-types';

export interface GeneratedQuestion {
  id: string;
  question: string;
  reason: string;
  category: 'signal' | 'spec_gap' | 'clarification' | 'competency';
  signalId?: string;
  evidenceRefs: EvidenceSnippet[];
}

export interface TalentQuestions {
  id: string;
  workspace_id: string;
  talent_id: string;
  job_spec_id: string | null;
  questions: GeneratedQuestion[];
  cv_hash: string | null;
  spec_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateQuestionsRequest {
  workspaceId: string;
  talentId: string;
  jobSpecId?: string;
  forceRegenerate?: boolean;
}

export interface GenerateQuestionsResponse {
  success: boolean;
  questions: GeneratedQuestion[];
  cached: boolean;
  error?: string;
}

/**
 * Question category labels
 */
export const QUESTION_CATEGORY_LABELS: Record<GeneratedQuestion['category'], string> = {
  signal: 'Signal-Based',
  spec_gap: 'Spec Alignment',
  clarification: 'Clarification',
  competency: 'Competency',
};

/**
 * Question category colors
 */
export const QUESTION_CATEGORY_COLORS: Record<GeneratedQuestion['category'], string> = {
  signal: 'bg-amber-500/10 text-amber-600 border-amber-200',
  spec_gap: 'bg-blue-500/10 text-blue-600 border-blue-200',
  clarification: 'bg-purple-500/10 text-purple-600 border-purple-200',
  competency: 'bg-green-500/10 text-green-600 border-green-200',
};
