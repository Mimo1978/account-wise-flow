import { useState, useRef, useEffect } from "react";
import { Search, X, Code, HelpCircle, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
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
import { cn } from "@/lib/utils";
import { BOOLEAN_SEARCH_EXAMPLES } from "@/lib/boolean-search-parser";

interface BooleanSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  isBooleanMode: boolean;
  onToggleBooleanMode: () => void;
  isValid: boolean;
  parseError?: string;
  isSearching: boolean;
  resultCount?: number;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export function BooleanSearchBar({
  query,
  onQueryChange,
  isBooleanMode,
  onToggleBooleanMode,
  isValid,
  parseError,
  isSearching,
  resultCount,
  onClear,
  placeholder = "Search candidates...",
  className,
}: BooleanSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Focus input on Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onClear();
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClear]);

  const handleExampleClick = (example: string) => {
    onQueryChange(example);
    if (!isBooleanMode) {
      onToggleBooleanMode();
    }
    setShowHelp(false);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      {/* Main search input */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={isBooleanMode ? 'java AND (kafka OR "event driven")...' : placeholder}
          className={cn(
            "pl-9 pr-24 h-10",
            !isValid && query && "border-destructive focus-visible:ring-destructive"
          )}
        />

        {/* Status indicators inside input */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isSearching && (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
          
          {query && !isSearching && isValid && resultCount !== undefined && (
            <Badge variant="secondary" className="text-xs font-normal">
              {resultCount} {resultCount === 1 ? "match" : "matches"}
            </Badge>
          )}

          {query && !isValid && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{parseError || "Invalid query syntax"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>

      {/* Boolean mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={isBooleanMode}
            onPressedChange={onToggleBooleanMode}
            size="sm"
            aria-label="Boolean search mode"
            className={cn(
              "gap-1.5 text-xs px-3 h-10 border",
              isBooleanMode 
                ? "bg-primary/10 text-primary border-primary/30" 
                : "border-input"
            )}
          >
            <Code className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Boolean</span>
          </Toggle>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {isBooleanMode ? "Boolean mode active" : "Enable Boolean search"}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Help popover */}
      <Popover open={showHelp} onOpenChange={setShowHelp}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <HelpCircle className="h-4 w-4" />
            <span className="sr-only">Search help</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-1">Boolean Search Syntax</h4>
              <p className="text-xs text-muted-foreground">
                Combine terms with operators for precise searches
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">AND</code>
                <span className="text-muted-foreground">Both terms required</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">OR</code>
                <span className="text-muted-foreground">Either term matches</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">NOT</code>
                <span className="text-muted-foreground">Exclude term</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">"..."</code>
                <span className="text-muted-foreground">Exact phrase</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">(...)</code>
                <span className="text-muted-foreground">Group conditions</span>
              </div>
            </div>

            <div className="border-t pt-3">
              <h5 className="text-xs font-medium mb-2 text-muted-foreground">
                Try an example:
              </h5>
              <div className="space-y-1.5">
                {BOOLEAN_SEARCH_EXAMPLES.slice(0, 4).map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(example.query)}
                    className="w-full text-left text-xs p-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <code className="font-mono text-primary">{example.query}</code>
                    <p className="text-muted-foreground mt-0.5">{example.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-2">
              <p className="text-[10px] text-muted-foreground">
                Press <kbd className="bg-muted px-1 rounded text-[10px]">⌘K</kbd> to focus search
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
