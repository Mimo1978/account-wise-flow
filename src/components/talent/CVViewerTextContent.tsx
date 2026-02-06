import { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { SearchMatch } from './CVViewerSearch';

interface CVViewerTextContentProps {
  text: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  className?: string;
}

export function CVViewerTextContent({
  text,
  matches,
  currentMatchIndex,
  className,
}: CVViewerTextContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMatchRef = useRef<HTMLSpanElement>(null);

  // Scroll to current match when it changes
  useEffect(() => {
    if (currentMatchRef.current && containerRef.current) {
      currentMatchRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex]);

  // Build highlighted text with React elements
  const highlightedContent = useMemo(() => {
    if (!text) return null;
    if (matches.length === 0) {
      return <span className="whitespace-pre-wrap">{text}</span>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, idx) => {
      // Add text before this match
      if (match.start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {text.slice(lastIndex, match.start)}
          </span>
        );
      }

      // Add the highlighted match
      const isCurrentMatch = idx === currentMatchIndex;
      elements.push(
        <span
          key={`match-${idx}`}
          ref={isCurrentMatch ? currentMatchRef : undefined}
          className={cn(
            'rounded px-0.5 transition-colors',
            isCurrentMatch
              ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
              : 'bg-accent/80 dark:bg-accent/60'
          )}
        >
          {text.slice(match.start, match.end)}
        </span>
      );

      lastIndex = match.end;
    });

    // Add remaining text after last match
    if (lastIndex < text.length) {
      elements.push(
        <span key={`text-end`} className="whitespace-pre-wrap">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  }, [text, matches, currentMatchIndex]);

  if (!text) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No text content available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-auto p-6 text-sm leading-relaxed font-mono',
        'selection:bg-primary/20',
        className
      )}
    >
      {highlightedContent}
    </div>
  );
}
