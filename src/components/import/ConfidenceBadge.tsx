import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  className?: string;
  showLabel?: boolean;
}

const confidenceConfig: Record<ConfidenceLevel, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  high: {
    label: "High",
    variant: "default",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  medium: {
    label: "Medium",
    variant: "secondary",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20",
  },
  low: {
    label: "Low",
    variant: "destructive",
    className: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20",
  },
};

export function ConfidenceBadge({ 
  confidence, 
  className,
  showLabel = true 
}: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        config.className,
        className
      )}
    >
      {showLabel ? config.label : confidence[0].toUpperCase()}
    </Badge>
  );
}

export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  return confidenceConfig[confidence].label;
}

export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case "high":
      return "text-emerald-600";
    case "medium":
      return "text-amber-600";
    case "low":
      return "text-red-600";
  }
}
