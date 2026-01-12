import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Network, Users, Sparkles, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface TooltipStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
}

const tooltipSteps: TooltipStep[] = [
  {
    id: "org-chart",
    title: "Org Charts",
    description: "Visualize company structures and relationships. Drag contacts to reposition them.",
    icon: Network,
    position: "center",
  },
  {
    id: "contacts",
    title: "Contact Cards",
    description: "Click any contact to see details, notes, and engagement history.",
    icon: Users,
    position: "top-left",
  },
  {
    id: "ai-insights",
    title: "AI Insights",
    description: "Get intelligent recommendations on who to engage next and why.",
    icon: Sparkles,
    position: "top-right",
  },
  {
    id: "knowledge",
    title: "AI Knowledge",
    description: "Ask questions about your accounts and get instant, contextual answers.",
    icon: Brain,
    position: "bottom-right",
  },
];

interface GuidedTooltipsProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export const GuidedTooltips = ({ onComplete, onDismiss }: GuidedTooltipsProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tooltipSteps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === tooltipSteps.length - 1;
  const isFirst = currentStep === 0;

  const handleNext = () => {
    if (isLast) {
      setIsVisible(false);
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const getPositionClasses = (position: TooltipStep["position"]) => {
    switch (position) {
      case "top-left":
        return "top-24 left-8";
      case "top-right":
        return "top-24 right-8";
      case "bottom-left":
        return "bottom-24 left-8";
      case "bottom-right":
        return "bottom-24 right-8";
      case "center":
      default:
        return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Subtle overlay */}
      <div className="fixed inset-0 bg-background/50 backdrop-blur-[2px] z-40 pointer-events-none" />

      {/* Tooltip card */}
      <div
        className={cn(
          "fixed z-50 w-80 bg-card border border-border rounded-xl shadow-lg p-4 animate-in fade-in-0 zoom-in-95 duration-200",
          getPositionClasses(step.position)
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 pr-4">
            <h4 className="font-semibold text-foreground mb-1">{step.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {tooltipSteps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  idx === currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
