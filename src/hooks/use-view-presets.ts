import { useState, useCallback, useEffect } from "react";

export interface ViewPreset {
  id: string;
  name: string;
  columns: string[];
  isBuiltIn?: boolean;
  icon?: string;
}

const STORAGE_KEY = "talent-view-presets";
const ACTIVE_PRESET_KEY = "talent-active-preset";

// Built-in presets
export const BUILT_IN_PRESETS: ViewPreset[] = [
  {
    id: "standard",
    name: "Standard",
    columns: ["name", "roleType", "seniority", "skills", "availability", "email", "phone", "location", "lastUpdated", "cvSource"],
    isBuiltIn: true,
    icon: "layout",
  },
  {
    id: "sales",
    name: "Sales",
    columns: ["name", "roleType", "seniority", "availability", "lastUpdated", "phone", "email"],
    isBuiltIn: true,
    icon: "trending-up",
  },
  {
    id: "data-cleanup",
    name: "Data Cleanup",
    columns: ["name", "roleType", "seniority", "email", "phone", "location", "cvSource"],
    isBuiltIn: true,
    icon: "sparkles",
  },
  {
    id: "recruiting",
    name: "Recruiting",
    columns: ["name", "roleType", "availability", "location", "skills", "aiOverview"],
    isBuiltIn: true,
    icon: "users",
  },
];

export function useViewPresets(allColumnIds: string[]) {
  // Load custom presets from localStorage
  const [customPresets, setCustomPresets] = useState<ViewPreset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load custom presets from localStorage");
    }
    return [];
  });

  // Active preset ID
  const [activePresetId, setActivePresetId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_PRESET_KEY);
      return stored || "standard";
    } catch (e) {
      return "standard";
    }
  });

  // All presets combined
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  // Get active preset
  const activePreset = allPresets.find((p) => p.id === activePresetId) || BUILT_IN_PRESETS[0];

  // Persist custom presets
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    } catch (e) {
      console.warn("Failed to save custom presets to localStorage");
    }
  }, [customPresets]);

  // Persist active preset
  useEffect(() => {
    try {
      if (activePresetId) {
        localStorage.setItem(ACTIVE_PRESET_KEY, activePresetId);
      }
    } catch (e) {
      console.warn("Failed to save active preset to localStorage");
    }
  }, [activePresetId]);

  const selectPreset = useCallback((presetId: string) => {
    setActivePresetId(presetId);
  }, []);

  const saveCustomPreset = useCallback(
    (name: string, columns: string[]) => {
      const id = `custom-${Date.now()}`;
      const newPreset: ViewPreset = {
        id,
        name,
        columns,
        isBuiltIn: false,
      };
      setCustomPresets((prev) => [...prev, newPreset]);
      setActivePresetId(id);
      return id;
    },
    []
  );

  const updateCustomPreset = useCallback(
    (presetId: string, updates: Partial<Pick<ViewPreset, "name" | "columns">>) => {
      setCustomPresets((prev) =>
        prev.map((p) =>
          p.id === presetId ? { ...p, ...updates } : p
        )
      );
    },
    []
  );

  const deleteCustomPreset = useCallback(
    (presetId: string) => {
      setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (activePresetId === presetId) {
        setActivePresetId("standard");
      }
    },
    [activePresetId]
  );

  const isCurrentViewModified = useCallback(
    (currentVisibleColumns: string[]) => {
      if (!activePreset) return false;
      const presetCols = new Set(activePreset.columns);
      const currentCols = new Set(currentVisibleColumns);
      
      if (presetCols.size !== currentCols.size) return true;
      for (const col of currentVisibleColumns) {
        if (!presetCols.has(col)) return true;
      }
      return false;
    },
    [activePreset]
  );

  return {
    allPresets,
    activePreset,
    activePresetId,
    customPresets,
    selectPreset,
    saveCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
    isCurrentViewModified,
  };
}
