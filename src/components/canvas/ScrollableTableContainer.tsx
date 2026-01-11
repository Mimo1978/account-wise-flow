import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollableTableContainerProps {
  children: ReactNode;
  className?: string;
}

export const ScrollableTableContainer = ({
  children,
  className,
}: ScrollableTableContainerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateScrollIndicators = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  };

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
  }, []);

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
          "absolute left-0 top-0 bottom-0 w-16 pointer-events-none z-20 transition-opacity duration-200",
          "bg-gradient-to-r from-background to-transparent",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo("left")}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-background border border-border shadow-md",
          "hover:bg-muted transition-all duration-200",
          showLeftFade ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Right Fade & Arrow */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-16 pointer-events-none z-20 transition-opacity duration-200",
          "bg-gradient-to-l from-background to-transparent",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo("right")}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-background border border-border shadow-md",
          "hover:bg-muted transition-all duration-200",
          showRightFade ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto h-full"
      >
        {children}
      </div>
    </div>
  );
};
