import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, User, Briefcase, MapPin, Sparkles, Search, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MatchBreakdown, MatchQuality, BooleanSearchResult } from "@/hooks/use-boolean-search";

interface SearchMatchSectionProps {
  result: BooleanSearchResult | null;
  className?: string;
}

interface MatchGroup {
  field: "title" | "skills" | "overview" | "location" | "cv";
  label: string;
  icon: React.ReactNode;
  score: number;
  hasMatch: boolean;
  snippets: string[];
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
 * Safely render HTML with highlighted terms
 */
function HighlightedSnippet({ html }: { html: string }) {
  // Sanitize: only allow <mark> tags
  const sanitized = html
    .replace(/<(?!\/?(mark)(?=>|\s[^>]*>))[^>]+>/gi, "")
    .replace(
      /<mark>/gi,
      '<mark class="bg-primary/20 text-foreground font-medium px-0.5 rounded">'
    );

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className="[&>mark]:bg-primary/20 [&>mark]:text-foreground [&>mark]:font-medium [&>mark]:px-0.5 [&>mark]:rounded"
    />
  );
}

/**
 * Search Match Explanation section for candidate profile
 * Only shows when user arrived via Boolean search
 */
export function SearchMatchSection({ result, className }: SearchMatchSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["title", "skills"]));

  if (!result) return null;

  const { matchScore, matchQuality, matchBreakdown, highlights, matchedIn } = result;
  const config = qualityConfig[matchQuality];
  const scorePercent = Math.round(matchScore);

  // Build match groups from breakdown
  const allGroups: MatchGroup[] = [
    {
      field: "title" as const,
      label: "Title / Role",
      icon: <User className="h-3.5 w-3.5" />,
      score: matchBreakdown.title_score,
      hasMatch: matchedIn.title,
      snippets: [], // Title matches shown as term matches
    },
    {
      field: "skills" as const,
      label: "Skills",
      icon: <Briefcase className="h-3.5 w-3.5" />,
      score: matchBreakdown.skills_score,
      hasMatch: matchedIn.skills,
      snippets: [], // Skills shown as term badges
    },
    {
      field: "overview" as const,
      label: "Overview / Summary",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      score: matchBreakdown.overview_score,
      hasMatch: matchedIn.overview,
      snippets: highlights.headline ? [highlights.headline] : [],
    },
    {
      field: "location" as const,
      label: "Location",
      icon: <MapPin className="h-3.5 w-3.5" />,
      score: matchBreakdown.location_score,
      hasMatch: matchedIn.location,
      snippets: [],
    },
    {
      field: "cv" as const,
      label: "CV Content",
      icon: <FileText className="h-3.5 w-3.5" />,
      score: matchBreakdown.cv_score,
      hasMatch: matchedIn.cv,
      snippets: highlights.cvSnippet ? [highlights.cvSnippet] : [],
    },
  ];
  
  const matchGroups = allGroups.filter(g => g.hasMatch);

  const toggleGroup = (field: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setExpandedGroups(newSet);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">Search Match Explanation</span>
            <Badge variant="outline" className={cn("text-xs", config.color)}>
              {scorePercent}% — {config.label}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border p-4 space-y-4">
            {/* Matched terms summary */}
            {highlights.matchedTerms.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  <Search className="h-3 w-3 inline-block mr-1" />
                  Search terms matched:
                </p>
                <div className="flex flex-wrap gap-1.5">
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

            {/* Match groups */}
            {matchGroups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Matches by source:</p>
                <div className="space-y-2">
                  {matchGroups.map((group) => (
                    <div
                      key={group.field}
                      className="border border-border/50 rounded-md overflow-hidden"
                    >
                      <button
                        onClick={() => toggleGroup(group.field)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
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
                          {expandedGroups.has(group.field) ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {expandedGroups.has(group.field) && (
                        <div className="px-3 py-2 text-sm border-t border-border/30 bg-background">
                          {group.snippets.length > 0 ? (
                            <div className="space-y-2">
                              {group.snippets.slice(0, 3).map((snippet, idx) => (
                                <p
                                  key={idx}
                                  className="text-xs text-muted-foreground leading-relaxed"
                                >
                                  "…<HighlightedSnippet html={snippet} />…"
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              {group.field === "skills"
                                ? `Matched skills from your search terms`
                                : group.field === "title"
                                ? `Title/role matched your search criteria`
                                : group.field === "location"
                                ? `Location matched your search criteria`
                                : `Content matched your search terms`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance note */}
            <p className="text-[10px] text-muted-foreground/70 pt-2 border-t border-border/30">
              Match scores reflect weighted relevance across profile fields. CV content only included when "Include CV text" is enabled.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
