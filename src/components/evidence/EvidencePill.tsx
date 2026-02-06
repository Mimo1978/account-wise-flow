import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, Quote } from 'lucide-react';
import type { EvidenceSnippet } from '@/lib/evidence-types';
import { cn } from '@/lib/utils';

interface EvidencePillProps {
  /** Evidence snippets to display */
  evidence: EvidenceSnippet[];
  /** Callback when user clicks "Open in CV Viewer" - receives documentId and scroll position */
  onOpenCV?: (documentId: string, position: number) => void;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Additional class names */
  className?: string;
}

/**
 * A subtle pill button that shows evidence snippets on click.
 * Keeps existing UI layout - just adds minimal evidence affordance.
 */
export function EvidencePill({ 
  evidence, 
  onOpenCV,
  size = 'sm',
  className 
}: EvidencePillProps) {
  if (!evidence || evidence.length === 0) return null;

  const confidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.5) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={cn(
            'h-auto px-1.5 py-0.5 text-xs font-normal gap-1',
            'text-muted-foreground',
            // Hover state polish
            'hover:text-primary hover:bg-primary/10',
            // Focus state for keyboard accessibility
            'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
            // Subtle transition
            'transition-colors duration-150',
            className
          )}
        >
          <Quote className="h-3 w-3" />
          Evidence
          {evidence.length > 1 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {evidence.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 shadow-lg border border-border/60" 
        align="start"
        sideOffset={6}
      >
        <div className="p-3 border-b bg-muted/30">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Quote className="h-4 w-4 text-primary" />
            Evidence from CV
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {evidence.length} snippet{evidence.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-3 space-y-3">
            {evidence.map((snippet, idx) => (
              <div 
                key={snippet.id || idx}
                className="space-y-2"
              >
                {idx > 0 && <div className="border-t pt-2" />}
                
                {/* Claim this supports */}
                <p className="text-xs text-muted-foreground">
                  Supports: <span className="font-medium text-foreground">{snippet.claimText}</span>
                </p>
                
                {/* The actual snippet with highlighting */}
                <div className="bg-muted/50 p-2 rounded border text-xs leading-relaxed italic">
                  <HighlightedSnippet 
                    text={snippet.snippetText} 
                    highlight={snippet.claimText}
                  />
                </div>
                
                {/* Confidence + Open link */}
                <div className="flex items-center justify-between">
                  <span className={cn('text-[10px]', confidenceColor(snippet.confidence))}>
                    {Math.round(snippet.confidence * 100)}% match
                  </span>
                  {snippet.documentId && onOpenCV && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-6 px-2 text-xs gap-1',
                        'text-muted-foreground hover:text-primary hover:bg-primary/10',
                        'focus-visible:ring-2 focus-visible:ring-primary/50',
                        'transition-colors duration-150'
                      )}
                      onClick={() => onOpenCV(snippet.documentId!, snippet.snippetStart)}
                    >
                      <FileText className="h-3 w-3" />
                      Open in CV
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Highlights search terms within snippet text
 */
function HighlightedSnippet({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight || !text) {
    return <span>"{text}"</span>;
  }

  // Simple case-insensitive highlight
  const regex = new RegExp(`(${escapeRegex(highlight)})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      "{parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200/60 font-medium px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}"
    </span>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default EvidencePill;
