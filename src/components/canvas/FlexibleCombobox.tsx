import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlexibleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
  createLabel?: string;
}

export const FlexibleCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Type or select...",
  className,
  createLabel = "Create",
}: FlexibleComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Filter options based on input
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return [...options];
    const search = inputValue.toLowerCase().trim();
    return options.filter((opt) =>
      opt.toLowerCase().includes(search)
    );
  }, [inputValue, options]);

  // Check if current value is a custom (not in options)
  const isCustomValue = inputValue.trim() && !options.includes(inputValue.trim());
  const showCreateOption = isCustomValue && inputValue.trim().length > 0;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Commit value on blur
        if (inputValue.trim() !== value) {
          onChange(inputValue.trim());
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, inputValue, value, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectOption = (option: string) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange(trimmed);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreateOption) {
        handleCreateNew();
      } else if (filteredOptions.length > 0) {
        handleSelectOption(filteredOptions[0]);
      } else {
        onChange(inputValue.trim());
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "h-7 text-xs pr-6",
            isCustomValue && inputValue.trim() && "border-yellow-500/50"
          )}
        />
        {isCustomValue && inputValue.trim() && (
          <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-yellow-500" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
          <ScrollArea className="max-h-[180px]">
            {/* Create new option */}
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent border-b border-border text-primary"
              >
                <Plus className="h-3 w-3" />
                {createLabel}: "{inputValue.trim()}"
              </button>
            )}

            {/* Existing options */}
            {filteredOptions.length > 0 ? (
              <div className="py-1">
                {filteredOptions.slice(0, 15).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent",
                      option === value && "bg-accent/50"
                    )}
                  >
                    {option === value && <Check className="h-3 w-3 text-primary" />}
                    <span className={option === value ? "font-medium" : ""}>
                      {option}
                    </span>
                  </button>
                ))}
                {filteredOptions.length > 15 && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground">
                    +{filteredOptions.length - 15} more...
                  </div>
                )}
              </div>
            ) : !showCreateOption ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No matches found
              </div>
            ) : null}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

