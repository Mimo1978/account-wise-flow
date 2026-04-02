import { useRef, useState, useEffect, ReactNode, useCallback, forwardRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PinnedEdgeFade, PinnedEdgeFadeRight } from "@/components/ui/pinned-edge-fade";

const SCROLL_HINT_STORAGE_KEY = "database-table-scroll-hint-dismissed-v2";

interface ScrollableTableContainerProps {
  children: ReactNode;
  className?: string;
  showScrollHint?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
  /** Width of left-pinned area for edge fade (includes checkbox if present) */
  leftPinnedWidth?: number;
  /** Width of right-pinned area for edge fade */
  rightPinnedWidth?: number;
  /** Callback when scroll position changes */
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const ScrollableTableContainer = forwardRef<HTMLDivElement, ScrollableTableContainerProps>(({
  children,
  className,
  showScrollHint = false,
  stickyHeader = false,
  maxHeight = "calc(100vh - 280px)",
  leftPinnedWidth = 0,
  rightPinnedWidth = 0,
  onScroll,
}, ref) => {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = (ref as React.RefObject<HTMLDivElement>) || internalScrollRef;
  
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const [hasScrolledRight, setHasScrolledRight] = useState(false);

  // Check if hint should be shown
  useEffect(() => {
    if (showScrollHint && hasScrollableContent) {
      const dismissed = localStorage.getItem(SCROLL_HINT_STORAGE_KEY);
      if (!dismissed) {
        setShowHint(true);
        // Auto-dismiss after 6 seconds
        const timeout = setTimeout(() => {
          dismissHint();
        }, 6000);
        return () => clearTimeout(timeout);
      }
    }
  }, [showScrollHint, hasScrollableContent]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    localStorage.setItem(SCROLL_HINT_STORAGE_KEY, "true");
  }, []);

  const updateScrollIndicators = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
    const isScrollable = scrollWidth > clientWidth + 5;
    
    setHasScrollableContent(isScrollable);
    setShowLeftFade(scrollLeft > 5);
    setShowRightFade(isScrollable && scrollLeft < scrollWidth - clientWidth - 5);
    setHasScrolledRight(scrollLeft > 5);
  }, [scrollRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    updateScrollIndicators();
    
    scrollEl.addEventListener("scroll", updateScrollIndicators, { passive: true });
    window.addEventListener("resize", updateScrollIndicators);
    
    // Initial check with delay for content to render
    const timeout = setTimeout(updateScrollIndicators, 100);
    // Re-check after fonts/images load
    const lateTimeout = setTimeout(updateScrollIndicators, 500);

    return () => {
      scrollEl.removeEventListener("scroll", updateScrollIndicators);
      window.removeEventListener("resize", updateScrollIndicators);
      clearTimeout(timeout);
      clearTimeout(lateTimeout);
    };
  }, [updateScrollIndicators, scrollRef]);

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
  }, [showHint, dismissHint, scrollRef]);

  // Shift + scroll for horizontal scrolling
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleWheel = (e: WheelEvent) => {
      // If shift is held, scroll horizontally
      if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        scrollEl.scrollLeft += e.deltaY;
      }
    };

    scrollEl.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      scrollEl.removeEventListener("wheel", handleWheel);
    };
  }, [scrollRef]);

  const scrollTo = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    
    const scrollAmount = scrollRef.current.clientWidth * 0.4;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleScrollInternal = (e: React.UIEvent<HTMLDivElement>) => {
    updateScrollIndicators();
    onScroll?.(e);
  };

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Premium Edge Fade - Left Pinned Boundary */}
      {leftPinnedWidth > 0 && (
        <PinnedEdgeFade
          leftOffset={leftPinnedWidth}
          visible={hasScrollableContent || hasScrolledRight}
          width={20}
        />
      )}
      
      {/* Premium Edge Fade - Right Pinned Boundary OR Far-Right Overflow */}
      {/* Shows when: right-pinned columns exist, OR content is hidden on right side */}
      {/* The gradient layer is pointer-events: none and does not interfere with column resize handles, dropdown menus, or row click */}
      <PinnedEdgeFadeRight
        rightOffset={rightPinnedWidth}
        visible={(rightPinnedWidth > 0 && hasScrollableContent) || showRightFade}
        width={20}
      />

      {/* Left Fade Gradient - Premium subtle effect */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-16 pointer-events-none z-20 transition-opacity duration-500 ease-out",
          "bg-gradient-to-r from-card via-card/60 to-transparent",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Left Scroll Nudger */}
      <button
        onClick={() => scrollTo("left")}
        className={cn(
          "absolute left-1.5 top-1/2 -translate-y-1/2 z-30",
          "p-1.5 rounded-full",
          "bg-background/90 backdrop-blur-sm border border-border/50 shadow-md",
          "hover:bg-muted hover:scale-110 hover:shadow-lg",
          "transition-all duration-200 ease-out",
          showLeftFade ? "opacity-80 hover:opacity-100" : "opacity-0 pointer-events-none scale-90"
        )}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Right Fade Gradient - Premium subtle effect */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-20 transition-opacity duration-500 ease-out",
          "bg-gradient-to-l from-card via-card/60 to-transparent",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Right Scroll Nudger */}
      <button
        onClick={() => scrollTo("right")}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 z-30",
          "p-1.5 rounded-full",
          "bg-background/90 backdrop-blur-sm border border-border/50 shadow-md",
          "hover:bg-muted hover:scale-110 hover:shadow-lg",
          "transition-all duration-200 ease-out",
          showRightFade ? "opacity-80 hover:opacity-100" : "opacity-0 pointer-events-none scale-90"
        )}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* First-time Scroll Hint - Auto-dismisses */}
      {showHint && showRightFade && (
        <div
          className={cn(
            "absolute right-12 bottom-3 z-40",
            "animate-in slide-in-from-right-2 fade-in duration-500"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/90 text-background shadow-xl text-xs font-medium">
            <ChevronsRight className="h-3.5 w-3.5 animate-pulse" />
            <span>Scroll to see more columns</span>
            <button
              className="ml-1 p-0.5 rounded-full hover:bg-background/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                dismissHint();
              }}
              aria-label="Dismiss hint"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto scroll-smooth"
        style={{ maxHeight }}
        onScroll={handleScrollInternal}
      >
        <div className={cn(
          stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-30 [&_thead_tr]:bg-muted [&_thead_tr]:shadow-[0_1px_3px_-1px_hsl(var(--border)/0.4)]"
        )}>
          {children}
        </div>
      </div>
    </div>
  );
});

ScrollableTableContainer.displayName = "ScrollableTableContainer";
