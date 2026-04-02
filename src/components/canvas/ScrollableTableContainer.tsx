import { useRef, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollableTableContainerProps {
  children: ReactNode;
  className?: string;
  showScrollHint?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string;
  leftPinnedWidth?: number;
  rightPinnedWidth?: number;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export const ScrollableTableContainer = forwardRef<HTMLDivElement, ScrollableTableContainerProps>(({
  children,
  className,
  maxHeight = "calc(100vh - 280px)",
  onScroll,
}, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

  return (
    <div
      ref={scrollRef}
      className={cn("cm-table-scroll overflow-x-auto overflow-y-auto scroll-smooth", className)}
      style={{ maxHeight }}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
});

ScrollableTableContainer.displayName = "ScrollableTableContainer";
