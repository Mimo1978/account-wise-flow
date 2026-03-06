import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { GuidedTourStep } from "@/hooks/use-jarvis";

export interface TourState {
  steps: GuidedTourStep[];
  currentStep: number;
  status: "running" | "paused" | "completed" | "idle";
}

interface GuidedTourPlayerProps {
  tour: TourState;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
}

export function GuidedTourPlayer({
  tour,
  onPause,
  onResume,
  onSkip,
  onStop,
}: GuidedTourPlayerProps) {
  // Keyboard shortcuts: Escape = pause/stop, Enter/Space = resume/next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (tour.status === "idle" || tour.status === "completed") return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (tour.status === "running") {
          onPause();
        } else {
          onStop();
        }
      }
    },
    [tour.status, onPause, onStop]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (tour.status === "idle" || tour.status === "completed") return null;

  const total = tour.steps.length;
  const current = tour.currentStep + 1;
  const currentStepData = tour.steps[tour.currentStep];
  const stepLabel =
    currentStepData?.speak ||
    currentStepData?.highlight ||
    currentStepData?.click ||
    "Processing…";

  return (
    <div className="mx-2 mb-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 animate-fade-in pointer-events-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1 rounded-full bg-primary/10 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-primary whitespace-nowrap">
          Step {current} of {total}
        </span>
      </div>

      {/* Step description */}
      <p className="text-xs text-foreground/80 truncate mb-1.5">{stepLabel}</p>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {tour.status === "paused" ? (
          <button
            onClick={onResume}
            className="text-[10px] px-2 py-0.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-accent transition-colors"
          >
            Pause
          </button>
        )}
        <button
          onClick={onSkip}
          className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:bg-accent transition-colors"
        >
          Next
        </button>
        <button
          onClick={onStop}
          className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          Stop
        </button>
        <span className="text-[9px] text-muted-foreground ml-auto">
          Esc to pause
        </span>
      </div>
    </div>
  );
}
