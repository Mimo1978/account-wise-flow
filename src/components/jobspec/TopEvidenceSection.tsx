import React from 'react';
import { Quote, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SnippetHighlight } from './SnippetHighlight';
import type { EvidenceSnippet } from '@/lib/evidence-types';

interface TopEvidenceSectionProps {
  snippets: string[];
  evidenceData?: EvidenceSnippet[];
  maxSnippets?: number;
  onOpenCV?: () => void;
  candidateName?: string;
}

/**
 * Displays top evidence snippets with highlighting
 * Performance: Only shows pre-computed snippets from match output, no CV loading
 */
export function TopEvidenceSection({
  snippets,
  evidenceData,
  maxSnippets = 3,
  onOpenCV,
  candidateName,
}: TopEvidenceSectionProps) {
  const displaySnippets = snippets.slice(0, maxSnippets);

  if (displaySnippets.length === 0) {
    return null;
  }

  // Calculate average confidence if evidence data available
  const avgConfidence = evidenceData?.length
    ? Math.round(
        (evidenceData.reduce((sum, e) => sum + e.confidence, 0) / evidenceData.length) * 100
      )
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Quote className="h-4 w-4 text-primary" />
          Top Evidence
          <Badge variant="secondary" className="text-[10px] font-normal">
            {displaySnippets.length} snippet{displaySnippets.length !== 1 ? 's' : ''}
          </Badge>
        </h4>
        {avgConfidence !== null && (
          <Badge 
            variant="outline" 
            className={
              avgConfidence >= 80 
                ? 'border-green-200 text-green-700 bg-green-50' 
                : avgConfidence >= 60
                ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                : 'border-muted'
            }
          >
            {avgConfidence}% match
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {displaySnippets.map((snippet, i) => (
          <SnippetHighlight
            key={i}
            snippet={snippet}
            maxLines={3}
            className="hover:border-primary/40 transition-colors"
          />
        ))}
      </div>

      {onOpenCV && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={onOpenCV}
        >
          <FileText className="h-4 w-4 mr-2" />
          Open Full CV
        </Button>
      )}
    </div>
  );
}
