import { MousePointer2, PenTool } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { CanvasMode } from "@/hooks/use-canvas-mode";

interface CanvasModeToggleProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
}

export const CanvasModeToggle = ({ mode, onModeChange }: CanvasModeToggleProps) => {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onModeChange(value as CanvasMode)}
      >
        <ToggleGroupItem value="browse" aria-label="Browse mode" className="gap-1.5 text-xs">
          <MousePointer2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Browse</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="edit" aria-label="Edit structure mode" className="gap-1.5 text-xs">
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit Structure</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === "edit" && (
        <Badge
          variant="secondary"
          className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2 py-0.5 animate-in fade-in"
        >
          Editing Structure
        </Badge>
      )}
    </div>
  );
};
