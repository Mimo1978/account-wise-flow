import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  X,
  HelpCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  Bookmark,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BOOLEAN_SEARCH_EXAMPLES } from "@/lib/boolean-search-parser";
import { useSavedSearches, SavedSearch } from "@/hooks/use-saved-searches";
import { SaveSearchModal } from "./SaveSearchModal";
import { SavedSearchesDropdown } from "./SavedSearchesDropdown";

type SearchMode = "simple" | "boolean";

interface InlineSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  isValid: boolean;
  parseError?: string;
  isSearching: boolean;
  resultCount?: number;
  onClear: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

const EXAMPLE_CHIPS = [
  { query: "aws AND terraform", label: "aws AND terraform" },
  { query: 'java AND (kafka OR rabbitmq)', label: "java AND (kafka OR rabbitmq)" },
  { query: '"programme manager" AND NOT junior', label: '"programme manager" AND NOT junior' },
];

export function InlineSearchBar({
  query,
  onQueryChange,
  mode,
  onModeChange,
  isValid,
  parseError,
  isSearching,
  resultCount,
  onClear,
  onSubmit,
  placeholder = "Search candidates...",
  className,
}: InlineSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

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
  const canSave = mode === "boolean" && isValid && query.trim().length > 0;

  // Focus input on Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onClear();
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClear]);

  const handleExampleClick = (exampleQuery: string) => {
    onQueryChange(exampleQuery);
    if (mode !== "boolean") {
      onModeChange("boolean");
    }
    setShowHelp(false);
    inputRef.current?.focus();
  };

  // Handle selecting a saved search
  const handleSelectSavedSearch = (search: SavedSearch) => {
    onQueryChange(search.query_string);
    if (mode !== search.mode) {
      onModeChange(search.mode);
    }
    updateLastRun(search.id);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSubmit?.();
    }
  };

  const isBooleanMode = mode === "boolean";

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main search row */}
      <div className="relative flex items-center gap-2">
        {/* Mode dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-10 gap-1.5 px-3 min-w-[100px] justify-between border",
                isBooleanMode && "bg-primary/10 text-primary border-primary/30"
              )}
            >
              <span className="text-xs font-medium">
                {isBooleanMode ? "Boolean" : "Simple"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem
              onClick={() => onModeChange("simple")}
              className={cn(mode === "simple" && "bg-muted")}
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm">Simple</span>
                <span className="text-xs text-muted-foreground">
                  Basic keyword search
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onModeChange("boolean")}
              className={cn(mode === "boolean" && "bg-muted")}
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm">Boolean</span>
                <span className="text-xs text-muted-foreground">
                  AND, OR, NOT, phrases
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              isBooleanMode
                ? 'java AND (kafka OR "event driven")...'
                : placeholder
            }
            className={cn(
              "pl-9 pr-20 h-10",
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

        {/* Help popover - only in Boolean mode */}
        {isBooleanMode && (
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
                    Press <kbd className="bg-muted px-1 rounded text-[10px]">⌘K</kbd> to focus • <kbd className="bg-muted px-1 rounded text-[10px]">Enter</kbd> to search
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Save search modal */}
      <SaveSearchModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        query={query}
        onSave={createSearch}
        isLoading={isCreating}
      />

      {/* Example chips - only in Boolean mode */}
      {isBooleanMode && !query && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLE_CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(chip.query)}
              className="text-xs px-2 py-1 rounded-full border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
