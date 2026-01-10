import { useState, useRef, useEffect, useMemo } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Handle click outside - commit value and close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelectOption = (option: string) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If there are filtered options and user hasn't typed something completely different, select first match
      if (filteredOptions.length > 0 && filteredOptions[0].toLowerCase().includes(inputValue.toLowerCase().trim())) {
        // Only auto-select if there's a close match, otherwise keep what user typed
        const exactMatch = filteredOptions.find(
          (opt) => opt.toLowerCase() === inputValue.toLowerCase().trim()
        );
        if (exactMatch) {
          handleSelectOption(exactMatch);
        } else {
          // User pressed enter with custom value - just close and keep it
          onChange(inputValue.trim());
          setIsOpen(false);
          inputRef.current?.blur();
        }
      } else {
        onChange(inputValue.trim());
        setIsOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Tab") {
      setIsOpen(false);
      onChange(inputValue.trim());
    }
  };

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
      />

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
          <ScrollArea className="max-h-[200px]">
            <div className="py-1">
              {filteredOptions.slice(0, 20).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                    option.toLowerCase() === inputValue.toLowerCase().trim() && "bg-accent/50"
                  )}
                >
                  {option.toLowerCase() === inputValue.toLowerCase().trim() && (
                    <Check className="h-3 w-3 text-primary flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      option.toLowerCase() === inputValue.toLowerCase().trim() && "font-medium"
                    )}
                  >
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
