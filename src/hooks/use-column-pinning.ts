import { useState, useCallback, useMemo, useEffect } from "react";

export type PinPosition = "left" | "right" | null;

export interface PinnableColumn {
  id: string;
  canPinLeft?: boolean;
  canPinRight?: boolean;
}

export interface ColumnPinState {
  [columnId: string]: PinPosition;
}

const STORAGE_KEY = "talent-column-pin-state";

// Default pinned columns configuration
const DEFAULT_PIN_STATE: ColumnPinState = {
  name: "left",
  availability: "right",
};

// Columns that can be pinned
// Left: Name, Role/Title (Job Title equivalent for Talent)
// Right: Availability (Status equivalent), Last Updated (Last Contacted equivalent)
export const PINNABLE_COLUMNS: PinnableColumn[] = [
  { id: "name", canPinLeft: true, canPinRight: false },
  { id: "roleType", canPinLeft: true, canPinRight: false },
  { id: "availability", canPinLeft: false, canPinRight: true },
  { id: "lastUpdated", canPinLeft: false, canPinRight: true },
];

export function useColumnPinning() {
  const [pinState, setPinState] = useState<ColumnPinState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load column pin state from localStorage");
    }
    return DEFAULT_PIN_STATE;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pinState));
    } catch (e) {
      console.warn("Failed to save column pin state to localStorage");
    }
  }, [pinState]);

  const togglePin = useCallback((columnId: string, position: PinPosition) => {
    setPinState((prev) => {
      const currentPosition = prev[columnId];
      // If already pinned to this position, unpin
      if (currentPosition === position) {
        const next = { ...prev };
        delete next[columnId];
        return next;
      }
      // Otherwise, pin to the new position
      return { ...prev, [columnId]: position };
    });
  }, []);

  const isPinned = useCallback(
    (columnId: string): PinPosition => {
      return pinState[columnId] || null;
    },
    [pinState]
  );

  const canPin = useCallback((columnId: string, position: "left" | "right"): boolean => {
    const config = PINNABLE_COLUMNS.find((c) => c.id === columnId);
    if (!config) return false;
    return position === "left" ? !!config.canPinLeft : !!config.canPinRight;
  }, []);

  const getLeftPinnedColumns = useCallback(
    (visibleColumns: { id: string }[]): string[] => {
      return visibleColumns
        .filter((col) => pinState[col.id] === "left")
        .map((col) => col.id);
    },
    [pinState]
  );

  const getRightPinnedColumns = useCallback(
    (visibleColumns: { id: string }[]): string[] => {
      return visibleColumns
        .filter((col) => pinState[col.id] === "right")
        .map((col) => col.id);
    },
    [pinState]
  );

  const resetToDefaults = useCallback(() => {
    setPinState(DEFAULT_PIN_STATE);
  }, []);

  return {
    pinState,
    togglePin,
    isPinned,
    canPin,
    getLeftPinnedColumns,
    getRightPinnedColumns,
    resetToDefaults,
  };
}
