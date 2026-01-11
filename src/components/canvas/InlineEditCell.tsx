import { useState, useRef, useEffect, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Pencil, Lock } from "lucide-react";

type EditType = "text" | "select" | "grouped-select";

interface SelectOption {
  value: string;
  label: string;
}

interface GroupedOptions {
  [group: string]: string[];
}

interface InlineEditCellProps {
  value: string;
  displayValue?: string | ReactNode;
  onSave: (value: string) => void;
  type?: EditType;
  options?: SelectOption[] | string[];
  groupedOptions?: GroupedOptions;
  placeholder?: string;
  className?: string;
  isEdited?: boolean;
  maxLength?: number;
  /** If true, editing is disabled with tooltip */
  disabled?: boolean;
  /** Tooltip message when disabled */
  disabledTooltip?: string;
}

export const InlineEditCell = ({
  value,
  displayValue,
  onSave,
  type = "text",
  options,
  groupedOptions,
  placeholder = "—",
  className,
  isEdited = false,
  maxLength = 255,
  disabled = false,
  disabledTooltip = "You don't have permission to edit this field",
}: InlineEditCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleSelectChange = (newValue: string) => {
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  // Handle click outside for text inputs
  useEffect(() => {
    if (!isEditing || type !== "text") return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, type, editValue, value]);

  if (isEditing) {
    if (type === "text") {
      return (
        <div ref={cellRef} className="relative">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="h-7 text-sm py-1 px-2"
            placeholder={placeholder}
          />
        </div>
      );
    }

    if (type === "select" && options) {
      const normalizedOptions: SelectOption[] = options.map((opt) =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      );

      return (
        <Select
          value={editValue}
          onValueChange={handleSelectChange}
          open={true}
          onOpenChange={(open) => !open && setIsEditing(false)}
        >
          <SelectTrigger className="h-7 text-sm py-1 px-2">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {normalizedOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === "grouped-select" && groupedOptions) {
      return (
        <Select
          value={editValue}
          onValueChange={handleSelectChange}
          open={true}
          onOpenChange={(open) => !open && setIsEditing(false)}
        >
          <SelectTrigger className="h-7 text-sm py-1 px-2">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Object.entries(groupedOptions).map(([group, items]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-xs font-semibold text-muted-foreground">
                  {group}
                </SelectLabel>
                {items.map((item) => (
                  <SelectItem key={item} value={item} className="text-sm">
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      );
    }
  }

  // Disabled state - show lock icon with tooltip
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-full text-left px-1.5 py-0.5 -mx-1.5 rounded transition-colors group cursor-not-allowed opacity-70",
              isEdited && "bg-amber-500/10 border-l-2 border-amber-500",
              className
            )}
          >
            <span className="flex items-center gap-1">
              <span className={cn(!displayValue && !value && "text-muted-foreground italic")}>
                {displayValue || value || placeholder}
              </span>
              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">{disabledTooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "w-full text-left px-1.5 py-0.5 -mx-1.5 rounded transition-colors group",
        "hover:bg-muted/50 cursor-pointer",
        isEdited && "bg-amber-500/10 border-l-2 border-amber-500",
        className
      )}
    >
      <span className="flex items-center gap-1">
        <span className={cn(!displayValue && !value && "text-muted-foreground italic")}>
          {displayValue || value || placeholder}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </span>
    </button>
  );
};
