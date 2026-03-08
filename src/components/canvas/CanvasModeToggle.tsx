import { MousePointer2, PenTool, Save, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanvasMode } from "@/hooks/use-canvas-mode";

interface CanvasModeToggleProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onSaveLayout?: () => void;
}

export const CanvasModeToggle = ({ mode, onModeChange, onSaveLayout }: CanvasModeToggleProps) => {
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
        <ToggleGroupItem value="edit" aria-label="Edit structure mode" className="gap-1.5 text-xs" data-jarvis-id="canvas-edit-button">
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit Structure</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === "edit" && (
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-2 py-0.5 animate-in fade-in"
          >
            Edit Mode Active
          </Badge>
          {onSaveLayout && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-7 text-xs"
              onClick={onSaveLayout}
              data-jarvis-id="canvas-save-layout"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={() => onModeChange("browse")}
          >
            <X className="w-3 h-3" />
            Exit
          </Button>
        </div>
      )}
    </div>
  );
};
