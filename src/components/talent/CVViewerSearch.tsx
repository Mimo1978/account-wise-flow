import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseBooleanQuery, BOOLEAN_SEARCH_EXAMPLES } from '@/lib/boolean-search-parser';

interface SearchMatch {
  start: number;
  end: number;
  term: string;
}

interface CVViewerSearchProps {
  text: string;
  onMatchesChange: (matches: SearchMatch[], currentIndex: number) => void;
  className?: string;
}

export function CVViewerSearch({ text, onMatchesChange, className }: CVViewerSearchProps) {
  const [query, setQuery] = useState('');
  const [isBooleanMode, setIsBooleanMode] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find all matches in text
  const findMatches = useCallback(
    (searchQuery: string, booleanMode: boolean): SearchMatch[] => {
      if (!searchQuery.trim() || !text) return [];

      const foundMatches: SearchMatch[] = [];
      let terms: string[] = [];

      if (booleanMode) {
        const parsed = parseBooleanQuery(searchQuery);
        if (!parsed.isValid) {
          setParseError(parsed.error || 'Invalid query');
          return [];
        }
        setParseError(null);
        terms = parsed.terms;
      } else {
        setParseError(null);
        // Simple search: split by spaces
        terms = searchQuery
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 0);
      }

      // Find all occurrences of each term
      const lowerText = text.toLowerCase();
      for (const term of terms) {
        if (!term) continue;
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi');
        let match;
        while ((match = regex.exec(lowerText)) !== null) {
          foundMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            term: match[0],
          });
        }
      }

      // Sort by position and dedupe overlapping matches
      foundMatches.sort((a, b) => a.start - b.start);
      const deduped: SearchMatch[] = [];
      for (const m of foundMatches) {
        const last = deduped[deduped.length - 1];
        if (!last || m.start >= last.end) {
          deduped.push(m);
        } else if (m.end > last.end) {
          // Extend the last match if this one overlaps and is longer
          last.end = m.end;
        }
      }

      return deduped;
    },
    [text]
  );

  // Update matches when query changes
  useEffect(() => {
    const newMatches = findMatches(query, isBooleanMode);
    setMatches(newMatches);
    setCurrentMatchIndex(newMatches.length > 0 ? 0 : -1);
    onMatchesChange(newMatches, newMatches.length > 0 ? 0 : -1);
  }, [query, isBooleanMode, findMatches, onMatchesChange]);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    onMatchesChange(matches, nextIndex);
  }, [matches, currentMatchIndex, onMatchesChange]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    onMatchesChange(matches, prevIndex);
  }, [matches, currentMatchIndex, onMatchesChange]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setMatches([]);
    setCurrentMatchIndex(-1);
    onMatchesChange([], -1);
    inputRef.current?.focus();
  }, [onMatchesChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevMatch();
        } else {
          goToNextMatch();
        }
      }
      // Ctrl/Cmd + F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextMatch, goToPrevMatch]);

  return (
    <div className={cn('flex items-center gap-2 p-3 bg-muted/50 border-b border-border', className)}>
      {/* Search input */}
      <div className="relative flex-1 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isBooleanMode ? 'e.g. "project manager" AND (MiFID OR EMIR)' : 'Search in document...'}
          className={cn(
            'pl-9 pr-8 h-9',
            parseError && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={clearSearch}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Boolean mode toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="boolean-mode"
          checked={isBooleanMode}
          onCheckedChange={setIsBooleanMode}
          className="data-[state=checked]:bg-primary"
        />
        <Label htmlFor="boolean-mode" className="text-xs text-muted-foreground cursor-pointer">
          Boolean
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm p-3">
              <p className="font-medium mb-2">Boolean Search Syntax</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {BOOLEAN_SEARCH_EXAMPLES.slice(0, 4).map((ex, i) => (
                  <li key={i}>
                    <code className="bg-muted px-1 rounded">{ex.query}</code>
                    <span className="ml-1">— {ex.description}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Match navigation */}
      {matches.length > 0 && (
        <div className="flex items-center gap-1.5 ml-2">
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            {currentMatchIndex + 1} / {matches.length}
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={goToPrevMatch}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous match (Shift+Enter)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={goToNextMatch}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next match (Enter)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <span className="text-xs text-destructive ml-2">{parseError}</span>
      )}
    </div>
  );
}

export type { SearchMatch };
