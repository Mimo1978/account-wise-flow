import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TourState } from "@/components/jarvis/GuidedTourPlayer";

export interface TourTooltipPosition {
  top: number;
  left: number;
  arrowSide: "top" | "bottom";
}

interface TourTooltipBubbleProps {
  tour: TourState;
  speechText: string;
  targetRect: DOMRect | null;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
  onDone?: () => void;
  isFinalStep?: boolean;
}

const TOOLTIP_W = 320;
const TOOLTIP_H_EST = 140;
const ARROW_SIZE = 8;
const MARGIN = 12;
const NAV_HEIGHT = 60;

function computePosition(targetRect: DOMRect | null): TourTooltipPosition {
  if (!targetRect) {
    // Centre of screen
    return {
      top: Math.max(NAV_HEIGHT, window.innerHeight / 2 - TOOLTIP_H_EST / 2),
      left: Math.max(MARGIN, window.innerWidth / 2 - TOOLTIP_W / 2),
      arrowSide: "top",
    };
  }

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  // Default: below element
  let arrowSide: "top" | "bottom" = "top";
  let top = targetRect.bottom + MARGIN;
  let left = targetRect.left;

  // If element is in bottom half, position above
  if (targetRect.top + targetRect.height / 2 > viewH / 2) {
    arrowSide = "bottom";
    top = targetRect.top - TOOLTIP_H_EST - MARGIN;
  }

  // Clamp horizontal
  left = Math.max(MARGIN, Math.min(viewW - TOOLTIP_W - MARGIN, left));

  // Clamp vertical
  top = Math.max(NAV_HEIGHT, Math.min(viewH - TOOLTIP_H_EST - MARGIN, top));

  return { top, left, arrowSide };
}

export function TourTooltipBubble({
  tour,
  speechText,
  targetRect,
  onPrevious,
  onNext,
  onExit,
  onDone,
  isFinalStep,
}: TourTooltipBubbleProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<TourTooltipPosition>(() => computePosition(targetRect));

  // Reposition when target changes
  useEffect(() => {
    const newPos = computePosition(targetRect);
    setPos(newPos);

    // Re-check after scroll settles
    const t = setTimeout(() => {
      setPos(computePosition(targetRect));
    }, 450);
    return () => clearTimeout(t);
  }, [targetRect, tour.currentStep]);

  // Escape to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onExit]);

  // Click outside to exit
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        // Check if clicking on a highlighted element — allow that
        const target = e.target as HTMLElement;
        if (
          target.closest(".jarvis-highlight") ||
          target.closest(".jarvis-section-glow") ||
          target.closest("[data-jarvis-section]")
        ) {
          return;
        }
        onExit();
      }
    };
    // Delay to avoid immediate exit on the click that opens the tour
    const t = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 500);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [onExit]);

  if (tour.status === "idle" || tour.status === "completed") return null;

  const total = tour.steps.length;
  const current = tour.currentStep + 1;
  const isPaused = tour.status === "paused";
  const isFirst = tour.currentStep === 0;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[99999] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        top: pos.top,
        left: pos.left,
        width: TOOLTIP_W,
      }}
    >
      {/* Arrow pointing toward element */}
      <div
        className="absolute w-0 h-0"
        style={
          pos.arrowSide === "top"
            ? {
                top: -ARROW_SIZE,
                left: 24,
                borderLeft: `${ARROW_SIZE}px solid transparent`,
                borderRight: `${ARROW_SIZE}px solid transparent`,
                borderBottom: `${ARROW_SIZE}px solid #378ADD`,
              }
            : {
                bottom: -ARROW_SIZE,
                left: 24,
                borderLeft: `${ARROW_SIZE}px solid transparent`,
                borderRight: `${ARROW_SIZE}px solid transparent`,
                borderTop: `${ARROW_SIZE}px solid #378ADD`,
              }
        }
      />

      {/* Tooltip body */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "#1A1F2E",
          border: "1px solid #378ADD",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Message */}
        <div className="px-4 pt-3 pb-2 flex items-start gap-2.5">
          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: "#378ADD20" }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "#378ADD" }} />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#F8FAFC" }}>
            {speechText || "Processing…"}
          </p>
        </div>

        {/* Controls */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={onPrevious}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors"
                style={{ color: "#94A3B8" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </button>
            )}
            {isFinalStep ? (
              <button
                onClick={onDone || onExit}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-md transition-colors"
                style={{ background: "#378ADD", color: "#fff" }}
              >
                Done
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors"
                style={{ color: "#378ADD" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#60A5FA")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#378ADD")}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium" style={{ color: "#64748B" }}>
              Step {current} of {total}
            </span>
            <button
              onClick={onExit}
              className="text-[10px] font-medium px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              style={{ color: "#EF4444" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EF444420")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X className="w-3 h-3" />
              Exit tour
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: "#2D3748" }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${(current / total) * 100}%`,
              background: "#378ADD",
            }}
          />
        </div>
      </div>
    </div>
  );
}
