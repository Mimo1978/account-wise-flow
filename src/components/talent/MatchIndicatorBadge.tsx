import { Badge } from "@/components/ui/badge";
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
 * Badge showing match quality and field breakdown
 */
export function MatchIndicatorBadge({ 
  matchedIn, 
  matchScore,
  matchQuality = "partial",
  matchBreakdown,
  className 
}: MatchIndicatorBadgeProps) {
  const hasAnyMatch = matchedIn.cv || matchedIn.skills || matchedIn.overview || matchedIn.title || matchedIn.location;
  
  if (!hasAnyMatch) return null;

  const config = qualityConfig[matchQuality];
  const QualityIcon = config.icon;

  // Build match parts for tooltip
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
