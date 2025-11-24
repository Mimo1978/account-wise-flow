import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";

interface CanvasSearchProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}

export const CanvasSearch = ({
  onSearch,
  onClear,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
}: CanvasSearchProps) => {
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery("");
    onClear();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, title, department..."
            className="pl-9 pr-9 w-80"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {matchCount > 0 && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentMatchIndex + 1} of {matchCount}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevMatch}
                disabled={matchCount <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNextMatch}
                disabled={matchCount <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
