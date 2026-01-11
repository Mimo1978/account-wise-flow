import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  Layout,
  TrendingUp,
  Sparkles,
  Users,
  Check,
  Plus,
  Trash2,
  Save,
  BookMarked,
} from "lucide-react";
import { ViewPreset, BUILT_IN_PRESETS } from "@/hooks/use-view-presets";
import { cn } from "@/lib/utils";

interface ViewPresetsDropdownProps {
  allPresets: ViewPreset[];
  activePreset: ViewPreset;
  activePresetId: string | null;
  isModified: boolean;
  onSelectPreset: (presetId: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onUpdatePreset: (presetId: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  layout: <Layout className="h-4 w-4" />,
  "trending-up": <TrendingUp className="h-4 w-4" />,
  sparkles: <Sparkles className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
};

export function ViewPresetsDropdown({
  allPresets,
  activePreset,
  activePresetId,
  isModified,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  onUpdatePreset,
}: ViewPresetsDropdownProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const builtInPresets = allPresets.filter((p) => p.isBuiltIn);
  const customPresets = allPresets.filter((p) => !p.isBuiltIn);

  const handleSave = () => {
    if (newPresetName.trim()) {
      onSavePreset(newPresetName.trim());
      setNewPresetName("");
      setShowSaveDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <BookMarked className="h-4 w-4" />
            <span className="hidden sm:inline">
              {activePreset.name}
              {isModified && " *"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            View Presets
          </div>
          
          {/* Built-in presets */}
          {builtInPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              className="gap-2"
            >
              {preset.icon && iconMap[preset.icon]}
              {!preset.icon && <Layout className="h-4 w-4" />}
              <span className="flex-1">{preset.name}</span>
              {activePresetId === preset.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}

          {/* Custom presets */}
          {customPresets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                My Presets
              </div>
              {customPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => onSelectPreset(preset.id)}
                  className="gap-2 group"
                >
                  <BookMarked className="h-4 w-4" />
                  <span className="flex-1">{preset.name}</span>
                  {activePresetId === preset.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePreset(preset.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete preset</TooltipContent>
                  </Tooltip>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />

          {/* Save current view */}
          {isModified && !activePreset.isBuiltIn && (
            <DropdownMenuItem
              onClick={() => onUpdatePreset(activePresetId!)}
              className="gap-2 text-primary"
            >
              <Save className="h-4 w-4" />
              <span>Update "{activePreset.name}"</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setShowSaveDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Save as New Preset...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save View Preset</DialogTitle>
            <DialogDescription>
              Save the current column configuration as a custom preset.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!newPresetName.trim()}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
