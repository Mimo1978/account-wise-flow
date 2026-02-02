import { useMemo, useState, useCallback, useRef, useEffect } from "react";

export interface PinnedColumnConfig {
  id: string;
  width: number;
}

interface UsePinnedTableStylesOptions {
  /** Columns pinned to the left (in order, first column is leftmost) */
  leftPinnedColumns: PinnedColumnConfig[];
  /** Columns pinned to the right (in order, first column is rightmost) */
  rightPinnedColumns: PinnedColumnConfig[];
  /** Width of the checkbox column (if present) */
  checkboxColumnWidth?: number;
  /** Whether the table has a checkbox column */
  hasCheckboxColumn?: boolean;
}

interface CellStyleResult {
  position?: "sticky";
  left?: number;
  right?: number;
  zIndex: number;
  boxShadow?: string;
}

/**
 * A shared hook that computes pinned column styles for database tables.
 * Provides consistent z-index stacking, offset calculations, and shadow dividers.
 * 
 * Z-Index Hierarchy:
 * - Checkbox (header): 31
 * - Checkbox (body): 21
 * - Pinned headers: 30
 * - Pinned body cells: 20
 * - Non-pinned headers: 10
 * - Non-pinned body cells: 1
 */
export function usePinnedTableStyles({
  leftPinnedColumns,
  rightPinnedColumns,
  checkboxColumnWidth = 50,
  hasCheckboxColumn = true,
}: UsePinnedTableStylesOptions) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledRight, setHasScrolledRight] = useState(false);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);

  // Calculate left offset for each left-pinned column
  const leftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = hasCheckboxColumn ? checkboxColumnWidth : 0;

    leftPinnedColumns.forEach((col) => {
      offsets[col.id] = currentOffset;
      currentOffset += col.width;
    });

    return offsets;
  }, [leftPinnedColumns, checkboxColumnWidth, hasCheckboxColumn]);

  // Calculate right offset for each right-pinned column
  const rightOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = 0;

    // Process in reverse order (rightmost first gets offset 0)
    const reversed = [...rightPinnedColumns].reverse();
    reversed.forEach((col) => {
      offsets[col.id] = currentOffset;
      currentOffset += col.width;
    });

    return offsets;
  }, [rightPinnedColumns]);

  // Check if a column is the last left-pinned or first right-pinned (for shadow dividers)
  const isLastLeftPinned = useCallback(
    (columnId: string) => {
      if (leftPinnedColumns.length === 0) return false;
      return leftPinnedColumns[leftPinnedColumns.length - 1].id === columnId;
    },
    [leftPinnedColumns]
  );

  const isFirstRightPinned = useCallback(
    (columnId: string) => {
      if (rightPinnedColumns.length === 0) return false;
      return rightPinnedColumns[0].id === columnId;
    },
    [rightPinnedColumns]
  );

  // Calculate total width of pinned areas for edge fade positioning
  const leftPinnedTotalWidth = useMemo(() => {
    if (leftPinnedColumns.length === 0) return hasCheckboxColumn ? checkboxColumnWidth : 0;
    const columnsWidth = leftPinnedColumns.reduce((sum, col) => sum + col.width, 0);
    return (hasCheckboxColumn ? checkboxColumnWidth : 0) + columnsWidth;
  }, [leftPinnedColumns, checkboxColumnWidth, hasCheckboxColumn]);

  const rightPinnedTotalWidth = useMemo(() => {
    if (rightPinnedColumns.length === 0) return 0;
    return rightPinnedColumns.reduce((sum, col) => sum + col.width, 0);
  }, [rightPinnedColumns]);

  // Handle scroll to track position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;

    // Show left fade when scrolled right (content hidden on left)
    setHasScrolledRight(scrollLeft > 5);
    // Check if there's scrollable content
    setHasScrollableContent(scrollWidth > clientWidth + 10);
  }, []);

  // Check scrollable content on mount and resize
  useEffect(() => {
    const checkScrollable = () => {
      if (tableContainerRef.current) {
        const { scrollWidth, clientWidth } = tableContainerRef.current;
        setHasScrollableContent(scrollWidth > clientWidth + 10);
      }
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);
    const timeout = setTimeout(checkScrollable, 100);

    return () => {
      window.removeEventListener("resize", checkScrollable);
      clearTimeout(timeout);
    };
  }, [leftPinnedColumns, rightPinnedColumns]);

  /**
   * Get cell styles for a pinned column.
   * @param columnId - The column ID
   * @param isHeader - Whether this is a header cell (affects z-index)
   * @param pinPosition - "left", "right", or null for non-pinned
   */
  const getCellStyles = useCallback(
    (
      columnId: string,
      isHeader: boolean,
      pinPosition: "left" | "right" | null
    ): CellStyleResult => {
      if (pinPosition === "left") {
        return {
          position: "sticky",
          left: leftOffsets[columnId] ?? 0,
          zIndex: isHeader ? 30 : 20,
          boxShadow: isLastLeftPinned(columnId)
            ? "4px 0 8px -4px hsl(var(--foreground) / 0.12)"
            : undefined,
        };
      } else if (pinPosition === "right") {
        return {
          position: "sticky",
          right: rightOffsets[columnId] ?? 0,
          zIndex: isHeader ? 30 : 20,
          boxShadow: isFirstRightPinned(columnId)
            ? "-4px 0 8px -4px hsl(var(--foreground) / 0.12)"
            : undefined,
        };
      }

      // Non-pinned columns get lower z-index
      return {
        zIndex: isHeader ? 10 : 1,
      };
    },
    [leftOffsets, rightOffsets, isLastLeftPinned, isFirstRightPinned]
  );

  /**
   * Get checkbox column styles (always sticky left at position 0)
   */
  const getCheckboxCellStyles = useCallback(
    (isHeader: boolean): React.CSSProperties => ({
      position: "sticky",
      left: 0,
      width: checkboxColumnWidth,
      minWidth: checkboxColumnWidth,
      maxWidth: checkboxColumnWidth,
      zIndex: isHeader ? 31 : 21,
    }),
    [checkboxColumnWidth]
  );

  return {
    tableContainerRef,
    hasScrolledRight,
    hasScrollableContent,
    handleScroll,
    leftPinnedTotalWidth,
    rightPinnedTotalWidth,
    getCellStyles,
    getCheckboxCellStyles,
    leftOffsets,
    rightOffsets,
    isLastLeftPinned,
    isFirstRightPinned,
  };
}

/**
 * Simple pinned column config for tables with a single pinned "Name" column.
 * Used by Contacts and Companies databases.
 */
export function createSimplePinnedConfig(nameColumnWidth: number = 200): {
  leftPinnedColumns: PinnedColumnConfig[];
  rightPinnedColumns: PinnedColumnConfig[];
} {
  return {
    leftPinnedColumns: [{ id: "name", width: nameColumnWidth }],
    rightPinnedColumns: [],
  };
}
