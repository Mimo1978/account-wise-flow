import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  Bookmark, 
  ChevronDown, 
  Clock, 
  Trash2, 
  Search,
  Sparkles 
} from "lucide-react";
import { SavedSearch } from "@/hooks/use-saved-searches";
import { cn } from "@/lib/utils";

interface SavedSearchesDropdownProps {
  savedSearches: SavedSearch[];
  isLoading: boolean;
  onSelect: (search: SavedSearch) => void;
  onDelete: (searchId: string) => void;
}

export function SavedSearchesDropdown({
  savedSearches,
  isLoading,
  onSelect,
  onDelete,
}: SavedSearchesDropdownProps) {
  const hasSearches = savedSearches.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "gap-1.5 h-9 px-3 font-medium",
            hasSearches && "border-primary/30 text-primary hover:text-primary"
          )}
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">Saved</span>
          {hasSearches && (
            <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {savedSearches.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Saved Searches
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !hasSearches ? (
          <div className="py-6 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No saved searches yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Save a Boolean search to see it here
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {savedSearches.map((search) => (
              <DropdownMenuItem
                key={search.id}
                className="flex items-start gap-3 p-3 cursor-pointer group"
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(search);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {search.name}
                  </div>
                  <code className="text-xs text-muted-foreground font-mono truncate block mt-0.5">
                    {search.query_string}
                  </code>
                  {search.last_run_at && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/70">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(search.last_run_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(search.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
