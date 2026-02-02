import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { BooleanSearchResult } from "@/hooks/use-boolean-search";

interface SearchContextValue {
  /** Store search result for a candidate (used when navigating to profile) */
  storeSearchResult: (candidateId: string, result: BooleanSearchResult) => void;
  /** Get stored search result for a candidate */
  getSearchResult: (candidateId: string) => BooleanSearchResult | null;
  /** Clear stored search result */
  clearSearchResult: (candidateId: string) => void;
  /** Clear all stored search results */
  clearAllResults: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

/**
 * Provider that stores Boolean search results temporarily
 * Used to pass match context when navigating from search results to candidate profile
 */
export function SearchContextProvider({ children }: { children: ReactNode }) {
  // Using a Map to store results by candidate ID
  const [resultsMap, setResultsMap] = useState<Map<string, BooleanSearchResult>>(new Map());

  const storeSearchResult = useCallback((candidateId: string, result: BooleanSearchResult) => {
    setResultsMap((prev) => {
      const next = new Map(prev);
      next.set(candidateId, result);
      return next;
    });
  }, []);

  const getSearchResult = useCallback((candidateId: string): BooleanSearchResult | null => {
    return resultsMap.get(candidateId) ?? null;
  }, [resultsMap]);

  const clearSearchResult = useCallback((candidateId: string) => {
    setResultsMap((prev) => {
      const next = new Map(prev);
      next.delete(candidateId);
      return next;
    });
  }, []);

  const clearAllResults = useCallback(() => {
    setResultsMap(new Map());
  }, []);

  return (
    <SearchContext.Provider
      value={{
        storeSearchResult,
        getSearchResult,
        clearSearchResult,
        clearAllResults,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearchContext must be used within a SearchContextProvider");
  }
  return context;
}
