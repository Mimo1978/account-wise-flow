import { Users, MapPin, Briefcase, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BooleanSearchResult } from "@/hooks/use-boolean-search";
import { CompactMatchBadge } from "./MatchIndicatorBadge";

/**
 * Safely render HTML with highlighted terms
 * Only allows <mark> tags for security
 */
function HighlightedText({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) {
    return <span>{fallback}</span>;
  }

  // Sanitize: only allow <mark> tags
  const sanitized = html
    .replace(/<(?!\/?(mark)(?=>|\s[^>]*>))[^>]+>/gi, "")
    .replace(/<mark>/gi, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-0.5 rounded">')

  return (
    <span 
      dangerouslySetInnerHTML={{ __html: sanitized }} 
      className="[&>mark]:bg-yellow-200 [&>mark]:dark:bg-yellow-900/50 [&>mark]:text-foreground [&>mark]:px-0.5 [&>mark]:rounded"
    />
  );
}

interface SearchResultCardProps {
  result: BooleanSearchResult;
  onClick?: () => void;
  className?: string;
}

export function SearchResultCard({ result, onClick, className }: SearchResultCardProps) {
  const { candidate, matchScore, matchQuality, matchBreakdown, highlights, matchedIn } = result;

  // Extract "Why matched" phrases
  const whyPhrases = matchBreakdown?.matched_phrases?.filter(Boolean).slice(0, 3) || [];
  const hasRecencyBoost = (matchBreakdown?.recency_boost ?? 1) > 1;

  // Build match location summary
  const matchLocations: string[] = [];
  if (matchedIn.title) matchLocations.push("Title");
  if (matchedIn.skills) matchLocations.push("Skills");
  if (matchedIn.overview) matchLocations.push("Overview");
  if (matchedIn.location) matchLocations.push("Location");
  if (matchedIn.cv) matchLocations.push("CV");
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-medium text-sm truncate">
                  <HighlightedText 
                    html={highlights.name} 
                    fallback={candidate.name} 
                  />
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {candidate.roleType}
                </p>
              </div>
              
              {/* Enhanced match badge with recency indicator */}
              <div className="flex items-center gap-1.5">
                {hasRecencyBoost && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Recent activity boost
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <CompactMatchBadge 
                        matchQuality={matchQuality}
                        matchScore={matchScore}
                      />
                    </div>
                  </TooltipTrigger>
                  {whyPhrases.length > 0 && (
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-[10px] font-medium mb-1">Why this matched:</p>
                      <ul className="space-y-0.5">
                        {whyPhrases.map((phrase, idx) => (
                          <li key={idx} className="text-[10px] text-muted-foreground">
                            • {phrase}
                          </li>
                        ))}
                      </ul>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>

            {/* Headline/Summary with highlights */}
            {highlights.headline && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">
                  <HighlightedText 
                    html={highlights.headline} 
                    fallback={candidate.aiOverview || ""} 
                  />
                </span>
              </div>
            )}

            {/* Location */}
            {candidate.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{candidate.location}</span>
              </div>
            )}

            {/* CV snippet with highlights */}
            {highlights.cvSnippet && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">
                  <HighlightedText 
                    html={highlights.cvSnippet} 
                    fallback="" 
                  />
                </span>
              </div>
            )}

            {/* Skills */}
            {candidate.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {candidate.skills.slice(0, 5).map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={cn(
                      "text-[10px] font-normal",
                      highlights.matchedTerms.some(
                        (term) => skill.toLowerCase().includes(term.toLowerCase())
                      ) && "bg-yellow-200/50 dark:bg-yellow-900/30 border-yellow-500/50"
                    )}
                  >
                    {skill}
                  </Badge>
                ))}
                {candidate.skills.length > 5 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    +{candidate.skills.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
