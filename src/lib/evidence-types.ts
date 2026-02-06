/**
 * Evidence-First Types
 * Links AI claims to exact snippets from CV parsed text
 */

export interface EvidenceSnippet {
  /** Unique identifier for this snippet */
  id: string;
  /** The claim this evidence supports */
  claimId: string;
  /** Human-readable claim text */
  claimText: string;
  /** The actual snippet from the CV */
  snippetText: string;
  /** Character position start in original document */
  snippetStart: number;
  /** Character position end in original document */
  snippetEnd: number;
  /** Reference to the source document */
  documentId: string | null;
  /** Confidence score 0-1 */
  confidence: number;
  /** Category of evidence (skill, experience, education, etc.) */
  category: 'skill' | 'experience' | 'company' | 'education' | 'certification' | 'other';
}

export interface ClaimWithEvidence {
  /** Unique claim identifier */
  id: string;
  /** The claim text displayed to user */
  text: string;
  /** Category for grouping */
  category: 'skill_match' | 'sector' | 'tenure' | 'recency' | 'risk' | 'summary';
  /** Associated evidence snippets (1-3 typically) */
  evidence: EvidenceSnippet[];
}

export interface MatchEvidence {
  /** All claims made by the AI with their evidence */
  claims: ClaimWithEvidence[];
  /** Timestamp when evidence was computed */
  computedAt: string;
  /** Version of evidence generation algorithm */
  version: string;
}

export interface ExtendedScoreBreakdown {
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
  };
  recency_analysis?: {
    years_since_relevant_role: number;
    has_recent_experience: boolean;
  };
  /** Structured evidence for all claims */
  evidence?: MatchEvidence;
}

/**
 * Helper to generate a claim ID
 */
export function generateClaimId(category: string, index: number): string {
  return `${category}-${index}-${Date.now().toString(36)}`;
}

/**
 * Helper to extract snippet from text with context
 */
export function extractSnippetContext(
  fullText: string,
  searchTerm: string,
  contextChars: number = 80
): { snippetText: string; start: number; end: number } | null {
  const lowerText = fullText.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const idx = lowerText.indexOf(lowerTerm);
  
  if (idx === -1) return null;
  
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(fullText.length, idx + searchTerm.length + contextChars);
  
  let snippet = fullText.substring(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  
  return {
    snippetText: snippet,
    start,
    end,
  };
}
