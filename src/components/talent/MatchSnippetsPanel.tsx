import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, User, Briefcase, MapPin, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BooleanSearchResult, MatchQuality } from "@/hooks/use-boolean-search";

interface MatchSnippetsPanelProps {
  open: boolean;
  onClose: () => void;
  result: BooleanSearchResult | null;
  candidateName: string;
}

interface SnippetGroup {
  field: string;
  label: string;
  icon: React.ReactNode;
  content: string;
  score: number;
}

const qualityConfig: Record<MatchQuality, { label: string; color: string }> = {
  strong: {
    label: "Strong match",
    color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
  },
  good: {
    label: "Good match",
    color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  },
  partial: {
    label: "Partial match",
    color: "bg-muted text-muted-foreground border-muted",
  },
};

/**
 * Lightweight panel displaying highlighted snippets from CV text
 * Groups snippets by source field with expandable sections
 */
export function MatchSnippetsPanel({
  open,
  onClose,
  result,
  candidateName,
}: MatchSnippetsPanelProps) {
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>("overview");

  if (!result) return null;

  const { highlights, matchScore, matchQuality, matchBreakdown, matchedIn } = result;
  const relevancePercent = Math.round(matchScore);
  const config = qualityConfig[matchQuality];

  // Build snippet groups from highlights
  const snippetGroups: SnippetGroup[] = [];
  
  if (matchedIn.title && highlights.name) {
    snippetGroups.push({
      field: "title",
      label: "Title / Name",
      icon: <User className="h-3.5 w-3.5" />,
      content: highlights.name,
      score: matchBreakdown.title_score,
    });
  }
  
  if (matchedIn.overview && highlights.headline) {
    snippetGroups.push({
      field: "overview",
      label: "Overview / Summary",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      content: highlights.headline,
      score: matchBreakdown.overview_score,
    });
  }
  
  if (matchedIn.cv && highlights.cvSnippet) {
    snippetGroups.push({
      field: "cv",
      label: "CV Content",
      icon: <FileText className="h-3.5 w-3.5" />,
      content: highlights.cvSnippet,
      score: matchBreakdown.cv_score,
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <SheetTitle className="text-lg">Match Details</SheetTitle>
            </div>
            <Badge
              variant="outline"
              className={cn("text-xs", config.color)}
            >
              {relevancePercent}% — {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{candidateName}</p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Matched terms */}
            {highlights.matchedTerms.length > 0 && (
              <div className="pb-4 border-b">
                <p className="text-xs text-muted-foreground mb-2">
                  Search terms matched:
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

            {/* Match source breakdown */}
            <div className="pb-4 border-b">
              <p className="text-xs text-muted-foreground mb-2">
                Matched in:
              </p>
              <div className="flex flex-wrap gap-2">
                {matchedIn.title && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                    <User className="h-3 w-3" />
                    Title
                    {matchBreakdown.title_score > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{matchBreakdown.title_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
                {matchedIn.skills && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                    <Briefcase className="h-3 w-3" />
                    Skills
                    {matchBreakdown.skills_score > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{matchBreakdown.skills_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
                {matchedIn.overview && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                    <Sparkles className="h-3 w-3" />
                    Overview
                    {matchBreakdown.overview_score > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{matchBreakdown.overview_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
                {matchedIn.location && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                    <MapPin className="h-3 w-3" />
                    Location
                    {matchBreakdown.location_score > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{matchBreakdown.location_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
                {matchedIn.cv && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                    <FileText className="h-3 w-3" />
                    CV
                    {matchBreakdown.cv_score > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        +{matchBreakdown.cv_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Snippet sections */}
            {snippetGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No highlighted snippets available</p>
                <p className="text-xs mt-1">
                  Enable "Include CV text" for richer match details
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Highlighted excerpts:
                </p>
                {snippetGroups.map((group) => (
                  <div
                    key={group.field}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedSnippet(expandedSnippet === group.field ? null : group.field)
                      }
                      className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{group.icon}</span>
                        <span className="text-xs font-medium">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.score > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{group.score.toFixed(1)}
                          </span>
                        )}
                        {expandedSnippet === group.field ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    <div
                      className={cn(
                        "px-3 py-2 text-sm transition-all bg-background",
                        expandedSnippet === group.field ? "" : "line-clamp-2"
                      )}
                    >
                      <HighlightedSnippet html={group.content} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Performance note */}
            <p className="text-[10px] text-muted-foreground/70 pt-4 border-t">
              Snippets show context around matched terms. Full CV is only loaded when explicitly requested.
            </p>
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
      '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-foreground font-medium px-0.5 rounded">'
    );

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className="[&>mark]:bg-yellow-200 [&>mark]:dark:bg-yellow-900/50 [&>mark]:text-foreground [&>mark]:font-medium [&>mark]:px-0.5 [&>mark]:rounded"
    />
  );
}
