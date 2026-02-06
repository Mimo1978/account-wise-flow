/**
 * Risk Signal Types
 * Neutral, explainable signals for talent assessment
 */

import type { EvidenceSnippet } from './evidence-types';

export type SignalSeverity = 'low' | 'med' | 'high';

export type SignalType = 
  | 'short_tenure'
  | 'unexplained_gap'
  | 'role_mismatch'
  | 'contract_hopping'
  | 'skill_gap'
  | 'recency_concern';

export interface TalentSignal {
  id: string;
  workspace_id: string;
  talent_id: string;
  signal_type: SignalType;
  severity: SignalSeverity;
  title: string;
  description: string;
  evidence: EvidenceSnippet[];
  is_dismissed: boolean;
  dismissed_by: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Job-specific signals stored in job_spec_matches.score_breakdown
 */
export interface JobMatchSignal {
  id: string;
  signal_type: SignalType;
  severity: SignalSeverity;
  title: string;
  description: string;
  evidence: EvidenceSnippet[];
  suggested_questions?: string[];
}

/**
 * Signal configuration (workspace-level or default)
 */
export interface SignalConfig {
  /** Minimum months to trigger short tenure for PM/BA roles */
  short_tenure_threshold_months: number;
  /** Maximum gap months before flagging */
  gap_threshold_months: number;
  /** Minimum sub-6-month stints to trigger contract hopping */
  contract_hop_min_stints: number;
  /** Months lookback for contract hopping detection */
  contract_hop_lookback_months: number;
}

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  short_tenure_threshold_months: 9,
  gap_threshold_months: 6,
  contract_hop_min_stints: 3,
  contract_hop_lookback_months: 24,
};

/**
 * Human-readable labels for signal types
 */
export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  short_tenure: 'Short Tenure',
  unexplained_gap: 'Employment Gap',
  role_mismatch: 'Role Mismatch',
  contract_hopping: 'Frequent Changes',
  skill_gap: 'Skill Gap',
  recency_concern: 'Recency Concern',
};

/**
 * Colors for severity badges
 */
export const SEVERITY_COLORS: Record<SignalSeverity, { bg: string; text: string; border: string }> = {
  low: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  med: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-200',
  },
  high: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
};

/**
 * Generate a unique signal ID
 */
export function generateSignalId(type: SignalType, index: number): string {
  return `sig-${type}-${index}-${Date.now().toString(36)}`;
}
