import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, Briefcase, Sparkles, MapPin, User, Star, Check, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchBreakdown, MatchQuality } from "@/hooks/use-boolean-search";

interface MatchIndicatorBadgeProps {
  matchedIn: {
    cv?: boolean;
    skills?: boolean;
    overview?: boolean;
    title?: boolean;
    location?: boolean;
  };
  matchScore?: number;
  matchQuality?: MatchQuality;
  matchBreakdown?: MatchBreakdown;
  matchedTerms?: string[];
  highlightSnippets?: {
    headline?: string;
    cvSnippet?: string;
  };
  className?: string;
}

const qualityConfig = {
  strong: {
    label: "Strong match",
    color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
    icon: Star,
  },
  good: {
    label: "Good match",
    color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    icon: Check,
  },
  partial: {
    label: "Partial match",
    color: "bg-muted text-muted-foreground border-muted",
    icon: CircleDot,
  },
};

/**
 * Safely render highlighted snippet (max 80 chars)
 */
function TruncatedSnippet({ html, maxLength = 80 }: { html: string; maxLength?: number }) {
  // Strip HTML tags for length calculation
  const plainText = html.replace(/<[^>]+>/g, "");
  const needsTruncation = plainText.length > maxLength;
  
  // Sanitize: only allow <mark> tags
  let sanitized = html
    .replace(/<(?!\/?(mark)(?=>|\s[^>]*>))[^>]+>/gi, "")
    .replace(/<mark>/gi, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-foreground font-medium px-0.5 rounded">');
  
  // Truncate if needed (rough - may break mid-tag but CSS will handle)
  if (needsTruncation && sanitized.length > maxLength + 50) {
    sanitized = sanitized.slice(0, maxLength + 50) + "…";
  }

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className="[&>mark]:bg-yellow-200 [&>mark]:dark:bg-yellow-900/50 [&>mark]:text-foreground [&>mark]:font-medium [&>mark]:px-0.5 [&>mark]:rounded"
    />
  );
}

/**
 * Badge showing match quality and field breakdown
 * Enhanced with hover card showing matched terms and snippets
 */
export function MatchIndicatorBadge({ 
  matchedIn, 
  matchScore,
  matchQuality = "partial",
  matchBreakdown,
  matchedTerms = [],
  highlightSnippets,
  className 
}: MatchIndicatorBadgeProps) {
  const hasAnyMatch = matchedIn.cv || matchedIn.skills || matchedIn.overview || matchedIn.title || matchedIn.location;
  
  if (!hasAnyMatch) return null;

  const config = qualityConfig[matchQuality];
  const QualityIcon = config.icon;

  // Build match parts for display
  const matchParts: { label: string; icon: React.ReactNode; score?: number }[] = [];
  
  if (matchedIn.title) {
    matchParts.push({ 
      label: "Title", 
      icon: <User className="h-2.5 w-2.5" />,
      score: matchBreakdown?.title_score 
    });
  }
  if (matchedIn.skills) {
    matchParts.push({ 
      label: "Skills", 
      icon: <Briefcase className="h-2.5 w-2.5" />,
      score: matchBreakdown?.skills_score 
    });
  }
  if (matchedIn.overview) {
    matchParts.push({ 
      label: "Overview", 
      icon: <Sparkles className="h-2.5 w-2.5" />,
      score: matchBreakdown?.overview_score 
    });
  }
  if (matchedIn.location) {
    matchParts.push({ 
      label: "Location", 
      icon: <MapPin className="h-2.5 w-2.5" />,
      score: matchBreakdown?.location_score 
    });
  }
  if (matchedIn.cv) {
    matchParts.push({ 
      label: "CV", 
      icon: <FileText className="h-2.5 w-2.5" />,
      score: matchBreakdown?.cv_score 
    });
  }

  const scorePercent = matchScore !== undefined ? Math.round(matchScore) : null;
  const hasSnippets = highlightSnippets?.headline || highlightSnippets?.cvSnippet;

  // Use HoverCard for richer content, Tooltip for simple display
  if (hasSnippets || matchedTerms.length > 0) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-medium gap-1 cursor-help",
              config.color,
              className
            )}
          >
            <QualityIcon className="h-3 w-3" />
            <span>{config.label}</span>
          </Badge>
        </HoverCardTrigger>
        <HoverCardContent side="left" align="start" className="w-72 p-3">
          <div className="space-y-3">
            {/* Header with score */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{config.label}</span>
              {scorePercent !== null && (
                <span className="text-xs text-muted-foreground">
                  Score: {scorePercent}%
                </span>
              )}
            </div>

            {/* Matched in fields */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Matched in:</p>
              <div className="flex flex-wrap gap-1">
                {matchParts.map((part) => (
                  <span 
                    key={part.label} 
                    className="inline-flex items-center gap-1 text-[10px] bg-muted/50 px-1.5 py-0.5 rounded"
                  >
                    {part.icon}
                    {part.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Matched terms */}
            {matchedTerms.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Matched terms:</p>
                <div className="flex flex-wrap gap-1">
                  {matchedTerms.slice(0, 6).map((term) => (
                    <Badge
                      key={term}
                      variant="outline"
                      className="text-[10px] font-normal bg-primary/10 border-primary/30 px-1.5 py-0"
                    >
                      {term}
                    </Badge>
                  ))}
                  {matchedTerms.length > 6 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{matchedTerms.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Preview snippets */}
            {highlightSnippets?.headline && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Overview match:</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  "…<TruncatedSnippet html={highlightSnippets.headline} />…"
                </p>
              </div>
            )}

            {highlightSnippets?.cvSnippet && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">CV match:</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 bg-muted/30 px-1.5 py-1 rounded">
                  "…<TruncatedSnippet html={highlightSnippets.cvSnippet} />…"
                </p>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Simple tooltip fallback
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium gap-1 cursor-help",
            config.color,
            className
          )}
        >
          <QualityIcon className="h-3 w-3" />
          <span>{config.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium">{config.label}</span>
            {scorePercent !== null && (
              <span className="text-xs text-muted-foreground">
                Score: {scorePercent}%
              </span>
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Matched in:</p>
            <div className="flex flex-wrap gap-1.5">
              {matchParts.map((part) => (
                <span 
                  key={part.label} 
                  className="inline-flex items-center gap-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded"
                >
                  {part.icon}
                  {part.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact match badge for use in table cells
 */
export function CompactMatchBadge({ 
  matchQuality = "partial",
  matchScore,
  className 
}: { 
  matchQuality?: MatchQuality;
  matchScore?: number;
  className?: string;
}) {
  const config = qualityConfig[matchQuality];
  const QualityIcon = config.icon;
  const scorePercent = matchScore !== undefined ? Math.round(matchScore) : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium gap-1",
        config.color,
        className
      )}
    >
      <QualityIcon className="h-3 w-3" />
      {scorePercent !== null ? `${scorePercent}%` : config.label}
    </Badge>
  );
}
