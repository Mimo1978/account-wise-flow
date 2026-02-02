import { useState, useRef, useEffect } from "react";
import { Search, X, Code, HelpCircle, AlertCircle, Loader2, ChevronDown, Sparkles, Bookmark } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BOOLEAN_SEARCH_EXAMPLES } from "@/lib/boolean-search-parser";
import { useSavedSearches, SavedSearch } from "@/hooks/use-saved-searches";
import { SaveSearchModal } from "./SaveSearchModal";
import { SavedSearchesDropdown } from "./SavedSearchesDropdown";

interface BooleanSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  isBooleanMode: boolean;
  onToggleBooleanMode: () => void;
  onSetBooleanMode?: (mode: boolean) => void;
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
  onSetBooleanMode,
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
  const [showQuickRef, setShowQuickRef] = useState(false);

  // Saved searches hook
  const {
    savedSearches,
    isLoading: isLoadingSavedSearches,
    isModalOpen,
    setIsModalOpen,
    createSearch,
    isCreating,
    updateLastRun,
    deleteSearch,
  } = useSavedSearches();

  // Can save: Boolean mode + valid query + has content
  const canSave = isBooleanMode && isValid && query.trim().length > 0;

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

  // Handle selecting a saved search
  const handleSelectSavedSearch = (search: SavedSearch) => {
    onQueryChange(search.query_string);
    if (!isBooleanMode && search.mode === "boolean") {
      if (onSetBooleanMode) {
        onSetBooleanMode(true);
      } else {
        onToggleBooleanMode();
      }
    }
    updateLastRun(search.id);
    inputRef.current?.focus();
  };

  const operators = [
    { symbol: "AND", description: "Both terms required", example: "java AND python" },
    { symbol: "OR", description: "Either term matches", example: "react OR vue" },
    { symbol: "NOT", description: "Exclude term", example: "engineer NOT junior" },
    { symbol: '"..."', description: "Exact phrase", example: '"data scientist"' },
    { symbol: "(...)", description: "Group conditions", example: "(java OR python) AND senior" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative flex items-center gap-2">
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

        {/* Save search button - only shows in Boolean mode with valid query */}
        {canSave && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 gap-1.5 px-3 text-xs"
                onClick={() => setIsModalOpen(true)}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Save this search</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Saved searches dropdown */}
        <SavedSearchesDropdown
          savedSearches={savedSearches}
          isLoading={isLoadingSavedSearches}
          onSelect={handleSelectSavedSearch}
          onDelete={deleteSearch}
        />

        {/* Help popover */}
        <Popover open={showHelp} onOpenChange={setShowHelp}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Search help</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="end">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Boolean Search</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Combine terms with operators for precise talent matching
                  </p>
                </div>
              </div>

              {/* Operators grid */}
              <div className="grid grid-cols-2 gap-2">
                {operators.map((op) => (
                  <div 
                    key={op.symbol}
                    className="p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="px-1.5 py-0.5 rounded bg-background font-mono text-xs font-medium text-primary">
                        {op.symbol}
                      </code>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {op.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Examples section */}
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span className="h-px flex-1 bg-border" />
                  Try an example
                  <span className="h-px flex-1 bg-border" />
                </h5>
                <div className="space-y-1">
                  {BOOLEAN_SEARCH_EXAMPLES.slice(0, 4).map((example, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(example.query)}
                      className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all group"
                    >
                      <code className="font-mono text-xs text-primary group-hover:text-primary/80">
                        {example.query}
                      </code>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {example.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-[10px] text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">⌘K</kbd> to focus
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> to clear
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Save search modal */}
      <SaveSearchModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        query={query}
        onSave={createSearch}
        isLoading={isCreating}
      />

      {/* Inline quick reference - shows when Boolean mode is active */}
      {isBooleanMode && (
        <Collapsible open={showQuickRef} onOpenChange={setShowQuickRef}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 border border-primary/10">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">Boolean Mode</span>
              </div>
              <span className="hidden sm:inline">
                Use <code className="font-mono bg-muted px-1 rounded">AND</code>{" "}
                <code className="font-mono bg-muted px-1 rounded">OR</code>{" "}
                <code className="font-mono bg-muted px-1 rounded">NOT</code> and{" "}
                <code className="font-mono bg-muted px-1 rounded">"phrases"</code> for precise search
              </span>
              <ChevronDown className={cn(
                "h-3 w-3 ml-auto transition-transform duration-200",
                showQuickRef && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/20">
              {operators.map((op) => (
                <button
                  key={op.symbol}
                  onClick={() => {
                    const insertion = op.symbol === '"..."' ? '""' : op.symbol === "(...)" ? "()" : ` ${op.symbol} `;
                    onQueryChange(query + insertion);
                    inputRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                >
                  <code className="font-mono text-xs font-medium text-primary">
                    {op.symbol}
                  </code>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {op.description}
                  </span>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
