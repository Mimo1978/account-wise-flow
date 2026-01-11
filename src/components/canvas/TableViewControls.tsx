import { useState } from "react";
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
import { Columns3, LayoutGrid, LayoutList, RotateCcw } from "lucide-react";

export type TableDensity = "compact" | "comfortable";

export interface TableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sticky?: boolean; // If true, cannot be hidden
  category?: string;
}

interface TableViewControlsProps {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  columns: TableColumnConfig[];
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onResetColumns: () => void;
}

export const TableViewControls = ({
  density,
  onDensityChange,
  columns,
  onColumnVisibilityChange,
  onResetColumns,
}: TableViewControlsProps) => {
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  const categorizedColumns = columns.reduce((acc, col) => {
    const category = col.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(col);
    return acc;
  }, {} as Record<string, TableColumnConfig[]>);

  const visibleCount = columns.filter((c) => c.visible).length;

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
