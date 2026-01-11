import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Columns3, LayoutGrid, LayoutList, RotateCcw, Maximize2, WrapText } from "lucide-react";

export type TableDensity = "compact" | "comfortable";

export interface TableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sticky?: boolean; // If true, cannot be hidden
  category?: string;
}

export interface TableViewPreferences {
  fitToScreen: boolean;
  wrapText: boolean;
}

interface TableViewControlsProps {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  columns: TableColumnConfig[];
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onResetColumns: () => void;
  // New optional props for view preferences
  viewPreferences?: TableViewPreferences;
  onViewPreferencesChange?: (prefs: TableViewPreferences) => void;
  storageKey?: string; // For persisting preferences
}

// Hook to manage persisted view preferences
export function useTableViewPreferences(storageKey: string) {
  const [preferences, setPreferences] = useState<TableViewPreferences>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return { fitToScreen: false, wrapText: false };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, storageKey]);

  return [preferences, setPreferences] as const;
}

export const TableViewControls = ({
  density,
  onDensityChange,
  columns,
  onColumnVisibilityChange,
  onResetColumns,
  viewPreferences,
  onViewPreferencesChange,
}: TableViewControlsProps) => {
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  const categorizedColumns = columns.reduce((acc, col) => {
    const category = col.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(col);
    return acc;
  }, {} as Record<string, TableColumnConfig[]>);

  const visibleCount = columns.filter((c) => c.visible).length;

  const handleFitToScreenChange = (pressed: boolean) => {
    if (viewPreferences && onViewPreferencesChange) {
      onViewPreferencesChange({ ...viewPreferences, fitToScreen: pressed });
    }
  };

  const handleWrapTextChange = (pressed: boolean) => {
    if (viewPreferences && onViewPreferencesChange) {
      onViewPreferencesChange({ ...viewPreferences, wrapText: pressed });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Density Toggle */}
      <ToggleGroup
        type="single"
        value={density}
        onValueChange={(value) => value && onDensityChange(value as TableDensity)}
        className="shrink-0"
      >
        <ToggleGroupItem
          value="compact"
          aria-label="Compact view"
          className="gap-1.5 text-xs px-2.5"
        >
          <LayoutList className="h-3.5 w-3.5" />
          Compact
        </ToggleGroupItem>
        <ToggleGroupItem
          value="comfortable"
          aria-label="Comfortable view"
          className="gap-1.5 text-xs px-2.5"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Comfortable
        </ToggleGroupItem>
      </ToggleGroup>

      {/* View Preference Toggles */}
      {viewPreferences && onViewPreferencesChange && (
        <>
          <Separator orientation="vertical" className="h-6" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={viewPreferences.fitToScreen}
                onPressedChange={handleFitToScreenChange}
                size="sm"
                aria-label="Fit to screen"
                className="gap-1.5 text-xs px-2.5 h-8 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fit
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Fit columns to screen width</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={viewPreferences.wrapText}
                onPressedChange={handleWrapTextChange}
                size="sm"
                aria-label="Wrap text"
                className="gap-1.5 text-xs px-2.5 h-8 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <WrapText className="h-3.5 w-3.5" />
                Wrap
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Wrap text in Name, Department, Job Title</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Column Picker */}
      <Popover open={isColumnPickerOpen} onOpenChange={setIsColumnPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <Columns3 className="h-3.5 w-3.5" />
            Columns
            <span className="text-muted-foreground text-xs">({visibleCount})</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">Show Columns</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onResetColumns}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-2">
            {Object.entries(categorizedColumns).map(([category, cols], idx) => (
              <div key={category}>
                {idx > 0 && <Separator className="my-2" />}
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {category}
                </div>
                {cols.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`col-${col.id}`}
                      checked={col.visible}
                      disabled={col.sticky}
                      onCheckedChange={(checked) =>
                        onColumnVisibilityChange(col.id, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`col-${col.id}`}
                      className={`text-sm flex-1 cursor-pointer ${
                        col.sticky ? "text-muted-foreground" : ""
                      }`}
                    >
                      {col.label}
                      {col.sticky && (
                        <span className="ml-1 text-xs text-muted-foreground">(sticky)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
