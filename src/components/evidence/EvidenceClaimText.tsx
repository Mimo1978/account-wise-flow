import React from 'react';
import { EvidencePill } from './EvidencePill';
import type { ClaimWithEvidence, EvidenceSnippet } from '@/lib/evidence-types';
import { cn } from '@/lib/utils';

interface EvidenceClaimTextProps {
  /** The claim text to display */
  text: string;
  /** Evidence snippets supporting this claim */
  evidence?: EvidenceSnippet[];
  /** Full claim object (alternative to text+evidence) */
  claim?: ClaimWithEvidence;
  /** Callback when user wants to view CV at position */
  onOpenCV?: (documentId: string, position: number) => void;
  /** Additional styling */
  className?: string;
  /** Whether to show as inline or block */
  inline?: boolean;
}

/**
 * Renders claim text with an inline evidence pill.
 * Minimal footprint - just adds the evidence affordance.
 */
export function EvidenceClaimText({
  text,
  evidence,
  claim,
  onOpenCV,
  className,
  inline = true,
}: EvidenceClaimTextProps) {
  const claimText = claim?.text || text;
  const claimEvidence = claim?.evidence || evidence || [];

  const hasEvidence = claimEvidence.length > 0;

  if (inline) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <span>{claimText}</span>
        {hasEvidence && (
          <EvidencePill 
            evidence={claimEvidence} 
            onOpenCV={onOpenCV}
            size="sm"
          />
        )}
      </span>
    );
  }

  return (
    <div className={cn('flex items-start justify-between gap-2', className)}>
      <span className="flex-1">{claimText}</span>
      {hasEvidence && (
        <EvidencePill 
          evidence={claimEvidence} 
          onOpenCV={onOpenCV}
          size="sm"
        />
      )}
    </div>
  );
}

export default EvidenceClaimText;
