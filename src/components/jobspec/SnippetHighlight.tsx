import React from 'react';

interface SnippetHighlightProps {
  snippet: string;
  maxLines?: number;
  className?: string;
}

/**
 * Displays a snippet with truncation to prevent performance issues
 * Handles highlighting of matched phrases (already marked in snippet)
 */
export function SnippetHighlight({ 
  snippet, 
  maxLines = 2,
  className = '' 
}: SnippetHighlightProps) {
  // Truncate to max lines
  const lines = snippet.split('\n').slice(0, maxLines).join('\n');
  const isTruncated = snippet.split('\n').length > maxLines;

  // Parse and highlight marked phrases (wrapped in ** or <mark> tags)
  const renderHighlightedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|<mark>.*?<\/mark>)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <mark key={i} className="bg-yellow-200/60 font-semibold px-0.5 rounded">
            {part.slice(2, -2)}
          </mark>
        );
      }
      if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
        return (
          <mark key={i} className="bg-yellow-200/60 font-semibold px-0.5 rounded">
            {part.slice(6, -7)}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-muted-foreground/20 ${className}`}>
      <p className="line-clamp-2 italic leading-relaxed">
        "{renderHighlightedText(lines)}"
        {isTruncated && <span className="ml-1">…</span>}
      </p>
    </div>
  );
}
