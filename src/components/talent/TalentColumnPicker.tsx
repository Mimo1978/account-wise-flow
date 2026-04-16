import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Columns3, ChevronDown, ChevronRight, PinOff, ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { ColumnConfig } from "@/hooks/use-resizable-columns";
import { PinPosition, PINNABLE_COLUMNS } from "@/hooks/use-column-pinning";
import { cn } from "@/lib/utils";

interface TalentColumnPickerProps {
  columns: ColumnConfig[];
  onToggleColumn: (columnId: string) => void;
  onToggleAll: (visible: boolean) => void;
  // Column pinning
  isPinned?: (columnId: string) => PinPosition;
  canPin?: (columnId: string, position: "left" | "right") => boolean;
  onTogglePin?: (columnId: string, position: PinPosition) => void;
  // External control
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TalentColumnPicker({
  columns,
  onToggleColumn,
  onToggleAll,
  isPinned,
  canPin,
  onTogglePin,
  open: externalOpen,
  onOpenChange,
}: TalentColumnPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Use external state if provided, otherwise internal
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Core", "Contact", "AI-Derived", "Operational"])
  );
  const requiredVisibleColumns = new Set(["hasCV"]);

  const categories = [
    { id: "Core", label: "Core" },
    { id: "Contact", label: "Contact" },
    { id: "AI-Derived", label: "AI-Derived" },
    { id: "Operational", label: "Operational" },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const allVisible = columns.every((col) => col.visible);
  const someVisible = columns.some((col) => col.visible) && !allVisible;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Toggle Columns</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onToggleAll(!allVisible)}
            >
              {allVisible ? "Hide All" : "Show All"}
            </Button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {categories.map((category) => {
            const categoryColumns = columns.filter(
              (col) => col.category === category.id
            );
            if (categoryColumns.length === 0) return null;

            const isExpanded = expandedCategories.has(category.id);
            const allCategoryVisible = categoryColumns.every((col) => col.visible);
            const someCategoryVisible =
              categoryColumns.some((col) => col.visible) && !allCategoryVisible;

            return (
              <div key={category.id} className="mb-1">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span>{category.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {categoryColumns.filter((c) => c.visible).length}/
                    {categoryColumns.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-1 mt-1">
                    {categoryColumns.map((column) => {
                      const pinPosition = isPinned?.(column.id);
                      const canPinLeft = canPin?.(column.id, "left");
                      const canPinRight = canPin?.(column.id, "right");
                      const hasPinOptions = canPinLeft || canPinRight;

                      return (
                        <div
                          key={column.id}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                            "hover:bg-muted/50"
                          )}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <Checkbox
                              checked={column.visible}
                              disabled={requiredVisibleColumns.has(column.id)}
                              onCheckedChange={() => onToggleColumn(column.id)}
                              className="h-4 w-4"
                            />
                            <span
                              className={cn(
                                column.visible
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {column.label}
                              {requiredVisibleColumns.has(column.id) && (
                                <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                              )}
                            </span>
                          </label>
                          
                          {/* Pin controls */}
                          {hasPinOptions && column.visible && (
                            <div className="flex items-center gap-0.5">
                              {canPinLeft && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-6 w-6",
                                        pinPosition === "left"
                                          ? "text-primary bg-primary/10"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin?.(column.id, "left");
                                      }}
                                    >
                                      <ArrowLeftToLine className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs">
                                      {pinPosition === "left" ? "Unpin from left" : "Pin to left"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {canPinRight && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-6 w-6",
                                        pinPosition === "right"
                                          ? "text-primary bg-primary/10"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin?.(column.id, "right");
                                      }}
                                    >
                                      <ArrowRightToLine className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">
                                    <p className="text-xs">
                                      {pinPosition === "right" ? "Unpin from right" : "Pin to right"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {pinPosition && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin?.(column.id, pinPosition);
                                      }}
                                    >
                                      <PinOff className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Unpin column</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
