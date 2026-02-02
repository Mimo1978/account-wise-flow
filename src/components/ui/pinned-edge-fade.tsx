import { cn } from "@/lib/utils";

interface PinnedEdgeFadeProps {
  /** Position from the left edge of the container (in pixels) */
  leftOffset: number;
  /** Whether the fade should be visible */
  visible?: boolean;
  /** Additional className overrides */
  className?: string;
  /** Width of the fade gradient (default: 16px) */
  width?: number;
}

/**
 * A subtle edge fade gradient that appears next to pinned columns.
 * This visually communicates "there is more off-screen" and creates 
 * a premium Notion/Airtable-style separation between pinned and scrollable areas.
 * 
 * - Non-interactive (pointer-events: none)
 * - Sits above scrollable cells but below menus/tooltips
 * - Uses semantic design tokens for theming
 */
export const PinnedEdgeFade = ({
  leftOffset,
  visible = true,
  className,
  width = 16,
}: PinnedEdgeFadeProps) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 pointer-events-none z-[15]",
        "transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        left: leftOffset,
        width: `${width}px`,
        background: `linear-gradient(to right, hsl(var(--card) / 0.95), hsl(var(--card) / 0.6) 40%, transparent)`,
      }}
      aria-hidden="true"
    />
  );
};

interface PinnedEdgeFadeRightProps {
  /** Position from the right edge of the container (in pixels) */
  rightOffset: number;
  /** Whether the fade should be visible */
  visible?: boolean;
  /** Additional className overrides */
  className?: string;
  /** Width of the fade gradient (default: 16px) */
  width?: number;
}

/**
 * Right-side version of PinnedEdgeFade for right-pinned columns.
 */
export const PinnedEdgeFadeRight = ({
  rightOffset,
  visible = true,
  className,
  width = 16,
}: PinnedEdgeFadeRightProps) => {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 pointer-events-none z-[15]",
        "transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        right: rightOffset,
        width: `${width}px`,
        background: `linear-gradient(to left, hsl(var(--card) / 0.95), hsl(var(--card) / 0.6) 40%, transparent)`,
      }}
      aria-hidden="true"
    />
  );
};
