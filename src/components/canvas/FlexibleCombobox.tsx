import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlexibleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
}

export const FlexibleCombobox = ({
  value,
  onChange,
  options,
  placeholder = "Type to search...",
  className,
}: FlexibleComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Filter options based on input - prioritize matches at start, then includes
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return [...options].slice(0, 20);
    const search = inputValue.toLowerCase().trim();
    
    const startsWithMatches = options.filter((opt) =>
      opt.toLowerCase().startsWith(search)
    );
    const includesMatches = options.filter(
      (opt) =>
        opt.toLowerCase().includes(search) &&
        !opt.toLowerCase().startsWith(search)
    );
    
    return [...startsWithMatches, ...includesMatches];
  }, [inputValue, options]);

  const displayedOptions = filteredOptions.slice(0, 20);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Handle click outside - commit value and close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        // Commit value on blur if changed
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
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue); // Live update as user types
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectOption = useCallback((option: string) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => 
          prev < displayedOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : displayedOptions.length - 1
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && displayedOptions[highlightedIndex]) {
        // Select highlighted option
        handleSelectOption(displayedOptions[highlightedIndex]);
      } else {
        // Accept typed value as-is
        onChange(inputValue.trim());
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === "Tab") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      onChange(inputValue.trim());
    }
  };

  const isMatch = (option: string) => 
    option.toLowerCase() === inputValue.toLowerCase().trim();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-7 text-xs"
        autoComplete="off"
      />

      {isOpen && displayedOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
          <ScrollArea className="max-h-[200px]">
            <div ref={listRef} className="py-1">
              {displayedOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  data-index={index}
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                    highlightedIndex === index && "bg-accent",
                    highlightedIndex !== index && "hover:bg-accent/50",
                    isMatch(option) && highlightedIndex !== index && "bg-accent/30"
                  )}
                >
                  {isMatch(option) && (
                    <Check className="h-3 w-3 text-primary flex-shrink-0" />
                  )}
                  <span className={cn(isMatch(option) && "font-medium")}>
                    {option}
                  </span>
                </button>
              ))}
              {filteredOptions.length > 20 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
                  +{filteredOptions.length - 20} more results...
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
