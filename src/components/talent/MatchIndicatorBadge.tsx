import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, Briefcase, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchIndicatorBadgeProps {
  matchedIn: {
    cv?: boolean;
    skills?: boolean;
    overview?: boolean;
  };
  className?: string;
}

/**
 * Small badge showing which fields matched in Boolean search
 * "Matched in: CV / Skills / Overview"
 */
export function MatchIndicatorBadge({ matchedIn, className }: MatchIndicatorBadgeProps) {
  const hasAnyMatch = matchedIn.cv || matchedIn.skills || matchedIn.overview;
  
  if (!hasAnyMatch) return null;

  const matchParts: { label: string; icon: React.ReactNode }[] = [];
  
  if (matchedIn.cv) {
    matchParts.push({ label: "CV", icon: <FileText className="h-2.5 w-2.5" /> });
  }
  if (matchedIn.skills) {
    matchParts.push({ label: "Skills", icon: <Briefcase className="h-2.5 w-2.5" /> });
  }
  if (matchedIn.overview) {
    matchParts.push({ label: "Overview", icon: <Sparkles className="h-2.5 w-2.5" /> });
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-normal gap-1 bg-primary/5 border-primary/20 text-primary",
            className
          )}
        >
          <span className="opacity-60">Matched:</span>
          {matchParts.map((part, i) => (
            <span key={part.label} className="flex items-center gap-0.5">
              {part.icon}
              {part.label}
              {i < matchParts.length - 1 && <span className="opacity-40 mx-0.5">/</span>}
            </span>
          ))}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Search terms found in: {matchParts.map(p => p.label).join(", ")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
