import { useState, useCallback } from "react";

export type CanvasMode = "browse" | "edit";

interface UseCanvasModeReturn {
  mode: CanvasMode;
  isEditMode: boolean;
  isBrowseMode: boolean;
  setMode: (mode: CanvasMode) => void;
  toggleMode: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

/**
 * Hook to manage Canvas interaction mode (Browse vs Edit Structure).
 * Mode is persisted per session via sessionStorage.
 */
export function useCanvasMode(): UseCanvasModeReturn {
  const [mode, setModeState] = useState<CanvasMode>(() => {
    try {
      return (sessionStorage.getItem("canvas-mode") as CanvasMode) || "browse";
    } catch {
      return "browse";
    }
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const setMode = useCallback((newMode: CanvasMode) => {
    setModeState(newMode);
    try {
      sessionStorage.setItem("canvas-mode", newMode);
    } catch {}
    // Clear selection when switching modes
    if (newMode === "browse") {
      setSelectedNodeId(null);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "browse" ? "edit" : "browse");
  }, [mode, setMode]);

  return {
    mode,
    isEditMode: mode === "edit",
    isBrowseMode: mode === "browse",
    setMode,
    toggleMode,
    selectedNodeId,
    setSelectedNodeId,
  };
}
