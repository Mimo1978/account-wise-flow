import React from "react";
import { escapeHtml, sanitizeUrl } from "@/lib/safe-text";
import { cn } from "@/lib/utils";

interface SafeAITextProps {
  content: string;
  className?: string;
  /** Optional function to format text (e.g., replace [HIGHLIGHT:id] markers) */
  formatText?: (text: string) => string;
  /** Whether to render bold markdown (**text**) */
  renderBold?: boolean;
}

/**
 * Safely renders AI-generated text content without XSS vulnerabilities.
 * - Escapes all HTML to prevent script injection
 * - Converts **bold** markdown to styled spans
 * - Preserves whitespace and line breaks
 */
export function SafeAIText({ 
  content, 
  className,
  formatText,
  renderBold = true 
}: SafeAITextProps) {
  // First apply any text formatting (like replacing highlight markers)
  const formattedContent = formatText ? formatText(content) : content;
  
  // Parse content into segments (text and bold)
  const segments = parseContentSegments(formattedContent, renderBold);
  
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'bold') {
          return (
            <strong key={index} className="text-primary">
              {escapeHtml(segment.content)}
            </strong>
          );
        }
        return <React.Fragment key={index}>{escapeHtml(segment.content)}</React.Fragment>;
      })}
    </div>
  );
}

type ContentSegment = {
  type: 'text' | 'bold';
  content: string;
};

function parseContentSegments(text: string, renderBold: boolean): ContentSegment[] {
  if (!renderBold) {
    return [{ type: 'text', content: text }];
  }
  
  const segments: ContentSegment[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the bold segment
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    
    // Add the bold segment
    segments.push({
      type: 'bold',
      content: match[1],
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }
  
  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

interface SafeLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Safe link component that prevents javascript: URLs and adds security attributes
 */
export function SafeLink({ href, children, className }: SafeLinkProps) {
  const safeHref = sanitizeUrl(href);
  
  if (!safeHref) {
    // If URL is unsafe, render as plain text
    return <span className={className}>{children}</span>;
  }
  
  return (
    <a 
      href={safeHref}
      rel="noopener noreferrer"
      target="_blank"
      className={className}
    >
      {children}
    </a>
  );
}
