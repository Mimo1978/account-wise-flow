import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, X, RotateCcw, GripVertical } from "lucide-react";
import { useDraggable } from "@/hooks/use-draggable";
import { cn } from "@/lib/utils";

interface CanvasSearchProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onReset: () => void;
  workspaceId?: string;
  userId?: string;
}

// Approximate dimensions of the search bar
const BAR_WIDTH = 560;
const BAR_HEIGHT = 56;
// Fixed vertical offset below the ribbon toolbar
const DEFAULT_TOP = 141;

export const CanvasSearch = ({
  onSearch,
  onClear,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onReset,
  workspaceId,
  userId,
}: CanvasSearchProps) => {
  const [query, setQuery] = useState("");
  const [showHint, setShowHint] = useState(false);

  // Generate storage keys
  const storageKey = workspaceId && userId 
    ? `canvasSearchBarPos_v4:${workspaceId}:${userId}` 
    : 'canvasSearchBarPos_v4:default';
  const hintShownKey = workspaceId && userId 
    ? `canvasSearchBarHintShown:${workspaceId}:${userId}` 
    : 'canvasSearchBarHintShown:default';

  // Always center horizontally, fixed top position
  const getDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return { x: 300, y: DEFAULT_TOP };
    }
    const x = Math.round((window.innerWidth - BAR_WIDTH) / 2);
    const y = DEFAULT_TOP;
    return { x, y };
  }, []);

  const { position, dragRef, dragHandleProps, isDragging, isPositioned, resetToDefault } = useDraggable({
    bounds: "viewport",
    storageKey,
    getDefaultPosition,
  });

  // Check if we should show the hint animation (first time in this workspace)
  useEffect(() => {
    try {
      const hintShown = localStorage.getItem(hintShownKey);
      const hasSavedPosition = localStorage.getItem(storageKey);
      
      if (!hintShown && !hasSavedPosition) {
        setShowHint(true);
        // Mark hint as shown
        localStorage.setItem(hintShownKey, 'true');
        // Stop the hint after 3 seconds
        const timer = setTimeout(() => {
          setShowHint(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      // Ignore storage errors
    }
  }, [hintShownKey, storageKey]);

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery("");
    onClear();
  };

  const handleReset = () => {
    resetToDefault();
    onReset();
  };

  return (
    <div 
      ref={dragRef}
      className={cn(
        "fixed z-10 bg-background/95 backdrop-blur-sm border-2 border-primary/40 rounded-lg shadow-lg p-2",
        // Hide until positioned to prevent flash
        !isPositioned && "opacity-0",
        isPositioned && "animate-fade-in",
        // Subtle hint glow effect
        showHint && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
      )}
      style={{
        left: position.x,
        top: position.y,
        transition: isDragging 
          ? 'none' 
          : 'box-shadow 0.2s ease, opacity 0.15s ease, ring-color 0.3s ease',
      }}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <div 
          className={cn(
            "flex items-center justify-center p-1 rounded hover:bg-muted select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          {...dragHandleProps}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, title, department..."
            className="pl-9 pr-9 w-80"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {matchCount > 0 && (
          <div className="flex items-center gap-2 pl-2 border-l-2 border-primary/30">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentMatchIndex + 1} of {matchCount}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevMatch}
                disabled={matchCount <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNextMatch}
                disabled={matchCount <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {query.length > 0 && matchCount === 0 && (
          <div className="pl-2 border-l-2 border-primary/30">
            <span className="text-sm text-muted-foreground/60 whitespace-nowrap italic">
              No contacts found
            </span>
          </div>
        )}

        <div className="pl-2 border-l-2 border-primary/30">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset & Center
          </Button>
        </div>
      </div>
    </div>
  );
};
