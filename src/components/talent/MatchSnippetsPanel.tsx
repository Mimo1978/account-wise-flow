import { useState } from "react";
import { X, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BooleanSearchResult } from "@/hooks/use-boolean-search";

interface MatchSnippetsPanelProps {
  open: boolean;
  onClose: () => void;
  result: BooleanSearchResult | null;
  candidateName: string;
}

/**
 * Lightweight panel displaying highlighted snippets from CV text
 * Max 2-3 snippets
 */
export function MatchSnippetsPanel({
  open,
  onClose,
  result,
  candidateName,
}: MatchSnippetsPanelProps) {
  const [expandedSnippet, setExpandedSnippet] = useState<number | null>(null);

  if (!result) return null;

  const { highlights, rank } = result;
  const relevancePercent = Math.round(rank * 100);

  // Collect snippets
  const snippets: { type: string; content: string }[] = [];
  
  if (highlights.name) {
    snippets.push({ type: "Name", content: highlights.name });
  }
  if (highlights.headline) {
    snippets.push({ type: "Overview", content: highlights.headline });
  }
  if (highlights.cvSnippet) {
    snippets.push({ type: "CV Content", content: highlights.cvSnippet });
  }

  // Limit to 3 snippets
  const displaySnippets = snippets.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Match Details</SheetTitle>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                relevancePercent >= 70 && "bg-green-500/20 text-green-700 dark:text-green-400",
                relevancePercent >= 40 && relevancePercent < 70 && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                relevancePercent < 40 && "bg-muted text-muted-foreground"
              )}
            >
              {relevancePercent}% match
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{candidateName}</p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-4">
          <div className="space-y-4 pr-4">
            {displaySnippets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No highlighted matches available</p>
              </div>
            ) : (
              displaySnippets.map((snippet, index) => (
                <div
                  key={index}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedSnippet(expandedSnippet === index ? null : index)
                    }
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {snippet.type}
                    </span>
                    {expandedSnippet === index ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "px-3 py-2 text-sm transition-all",
                      expandedSnippet === index ? "" : "line-clamp-3"
                    )}
                  >
                    <HighlightedSnippet html={snippet.content} />
                  </div>
                </div>
              ))
            )}

            {/* Matched terms */}
            {highlights.matchedTerms.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  Matched terms:
                </p>
                <div className="flex flex-wrap gap-1">
                  {highlights.matchedTerms.map((term) => (
                    <Badge
                      key={term}
                      variant="outline"
                      className="text-xs font-normal bg-primary/10 border-primary/30"
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Safely render HTML with highlighted terms
 */
function HighlightedSnippet({ html }: { html: string }) {
  // Sanitize: only allow <mark> tags
  const sanitized = html
    .replace(/<(?!\/?(mark)(?=>|\s[^>]*>))[^>]+>/gi, "")
    .replace(
      /<mark>/gi,
      '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-0.5 rounded">'
    );

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className="[&>mark]:bg-yellow-200 [&>mark]:dark:bg-yellow-900/50 [&>mark]:text-foreground [&>mark]:px-0.5 [&>mark]:rounded"
    />
  );
}
