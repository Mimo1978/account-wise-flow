import { useRef, useState, useEffect, ReactNode, useCallback } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SCROLL_HINT_STORAGE_KEY = "database-table-scroll-hint-dismissed";

interface ScrollableTableContainerProps {
  children: ReactNode;
  className?: string;
  showScrollHint?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
}

export const ScrollableTableContainer = ({
  children,
  className,
  showScrollHint = false,
  stickyHeader = false,
  maxHeight = "calc(100vh - 280px)",
}: ScrollableTableContainerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Check if hint should be shown
  useEffect(() => {
    if (showScrollHint) {
      const dismissed = localStorage.getItem(SCROLL_HINT_STORAGE_KEY);
      if (!dismissed) {
        setShowHint(true);
        // Auto-dismiss after 8 seconds
        const timeout = setTimeout(() => {
          dismissHint();
        }, 8000);
        return () => clearTimeout(timeout);
      }
    }
  }, [showScrollHint]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    localStorage.setItem(SCROLL_HINT_STORAGE_KEY, "true");
  }, []);

  const updateScrollIndicators = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    updateScrollIndicators();
    
    scrollEl.addEventListener("scroll", updateScrollIndicators);
    window.addEventListener("resize", updateScrollIndicators);
    
    // Initial check with delay for content to render
    const timeout = setTimeout(updateScrollIndicators, 100);

    return () => {
      scrollEl.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateScrollIndicators);
      clearTimeout(timeout);
    };
  }, [updateScrollIndicators]);

  // Dismiss hint on first scroll
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !showHint) return;

    const handleFirstScroll = () => {
      dismissHint();
    };

    scrollEl.addEventListener("scroll", handleFirstScroll, { once: true });

    return () => {
      scrollEl.removeEventListener("scroll", handleFirstScroll);
    };
  }, [showHint, dismissHint]);

  const scrollTo = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    
    const scrollAmount = scrollRef.current.clientWidth * 0.5;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative flex-1", className)}>
      {/* Left Fade & Arrow */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-20 pointer-events-none z-20 transition-opacity duration-300",
          "bg-gradient-to-r from-card via-card/80 to-transparent",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo("left")}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-card border border-border shadow-lg",
          "hover:bg-muted hover:scale-105 transition-all duration-200",
          showLeftFade ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Right Fade & Arrow */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-20 pointer-events-none z-20 transition-opacity duration-300",
          "bg-gradient-to-l from-card via-card/80 to-transparent",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo("right")}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-card border border-border shadow-lg",
          "hover:bg-muted hover:scale-105 transition-all duration-200",
          showRightFade ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Scroll Hint Toast */}
      {showHint && showRightFade && (
        <div
          className={cn(
            "absolute right-4 bottom-4 z-40",
            "animate-in slide-in-from-right-4 fade-in duration-300"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground shadow-lg text-sm">
            <ArrowRight className="h-4 w-4 animate-pulse" />
            <span>Scroll for more columns</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-1 hover:bg-primary-foreground/20 text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                dismissHint();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto scroll-smooth",
          stickyHeader ? "overflow-y-auto" : "overflow-y-visible"
        )}
        style={stickyHeader ? { maxHeight } : undefined}
      >
        <div className={cn(stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead_tr]:bg-muted/95 [&_thead_tr]:backdrop-blur-sm")}>
          {children}
        </div>
      </div>
    </div>
  );
};
