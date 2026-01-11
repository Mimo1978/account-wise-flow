import { useState, useEffect, useCallback, useMemo } from "react";

interface ResponsiveColumnConfig {
  // Columns to hide at each breakpoint (cumulative)
  // Order matters: first items hide first as width decreases
  hideOrder: string[];
  // Breakpoints where columns start hiding
  breakpoints: {
    width: number;
    hideCount: number;
  }[];
  // Columns that should never be hidden
  alwaysVisible: string[];
}

const DEFAULT_CONFIG: ResponsiveColumnConfig = {
  hideOrder: [
    "location",      // Hide first
    "aiOverview",
    "keySkills", 
    "cvSource",
    "seniority",
    "lastUpdated",
    "skills",
    "phone",
    "email",
  ],
  breakpoints: [
    { width: 1400, hideCount: 0 },
    { width: 1200, hideCount: 2 },
    { width: 1000, hideCount: 4 },
    { width: 800, hideCount: 6 },
    { width: 600, hideCount: 8 },
  ],
  alwaysVisible: ["name", "availability"], // Name + Status always visible
};

export function useResponsiveColumns<T extends { id: string }>(
  visibleColumns: T[],
  config: Partial<ResponsiveColumnConfig> = {}
) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920
  );

  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate how many columns to hide based on current width
  const hideCount = useMemo(() => {
    const { breakpoints } = mergedConfig;
    // Sort breakpoints descending by width
    const sorted = [...breakpoints].sort((a, b) => b.width - a.width);
    
    for (const bp of sorted) {
      if (windowWidth >= bp.width) {
        return bp.hideCount;
      }
    }
    // Below smallest breakpoint, use max hide count
    return sorted[sorted.length - 1]?.hideCount || 0;
  }, [windowWidth, mergedConfig]);

  // Get list of column IDs to hide
  const responsivelyHiddenColumnIds = useMemo(() => {
    const { hideOrder, alwaysVisible } = mergedConfig;
    const hidden: string[] = [];
    
    // Only hide columns that are currently visible and not always-visible
    const visibleIds = new Set(visibleColumns.map((c) => c.id));
    const alwaysVisibleSet = new Set(alwaysVisible);
    
    let hiddenCount = 0;
    for (const colId of hideOrder) {
      if (hiddenCount >= hideCount) break;
      if (visibleIds.has(colId) && !alwaysVisibleSet.has(colId)) {
        hidden.push(colId);
        hiddenCount++;
      }
    }
    
    return hidden;
  }, [hideCount, visibleColumns, mergedConfig]);

  // Filter visible columns to exclude responsively hidden ones (preserving full type)
  const responsiveVisibleColumns = useMemo(() => {
    const hiddenSet = new Set(responsivelyHiddenColumnIds);
    return visibleColumns.filter((col) => !hiddenSet.has(col.id));
  }, [visibleColumns, responsivelyHiddenColumnIds]);

  return {
    windowWidth,
    responsiveVisibleColumns,
    responsivelyHiddenColumnIds,
    hiddenCount: responsivelyHiddenColumnIds.length,
  };
}
