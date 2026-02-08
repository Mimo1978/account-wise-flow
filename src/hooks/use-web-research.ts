import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  WebResearchConfig,
  WebResearchResult,
  WebResearchProvider,
  WebResearchProviderRegistry,
} from "@/lib/web-research-types";

/**
 * Hook for managing web research providers and executing searches.
 * 
 * Currently uses a stub backend that returns mock data.
 * When a real provider is connected, the backend will use it.
 */
export function useWebResearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<WebResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get available providers (currently just stub)
  const getProviderRegistry = useCallback((): WebResearchProviderRegistry => {
    // In future, this will check for connected providers
    const stubProvider: WebResearchProvider = {
      id: "stub",
      name: "Demo Mode",
      description: "Returns sample data for testing the UI workflow",
      available: true,
      search: async () => ({ success: false, error: "Stub only", people: [], stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 }, companyName: "", completedAt: new Date().toISOString() }),
    };

    const futureProviders: WebResearchProvider[] = [
      {
        id: "perplexity",
        name: "Perplexity AI",
        description: "AI-powered web search with citations",
        available: false,
        unavailableReason: "Not connected - requires API key",
        search: async () => ({ success: false, error: "Not connected", people: [], stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 }, companyName: "", completedAt: new Date().toISOString() }),
      },
      {
        id: "firecrawl",
        name: "Firecrawl",
        description: "Web scraping for company websites",
        available: false,
        unavailableReason: "Not connected - requires API key",
        search: async () => ({ success: false, error: "Not connected", people: [], stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 }, companyName: "", completedAt: new Date().toISOString() }),
      },
    ];

    return {
      providers: [stubProvider, ...futureProviders],
      activeProvider: "stub", // Will be null or provider id when connected
    };
  }, []);

  // Execute a web research search
  const executeSearch = useCallback(async (config: WebResearchConfig): Promise<WebResearchResult> => {
    setIsSearching(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("orgchart-web-research", {
        body: config,
      });

      if (fnError) {
        throw fnError;
      }

      const searchResult = data as WebResearchResult;
      setResult(searchResult);
      return searchResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Search failed";
      setError(errorMessage);
      
      // Return error result
      const errorResult: WebResearchResult = {
        success: false,
        companyName: config.companyName,
        people: [],
        stats: {
          totalFound: 0,
          highConfidence: 0,
          mediumConfidence: 0,
          lowConfidence: 0,
          sourcesChecked: 0,
        },
        error: errorMessage,
        completedAt: new Date().toISOString(),
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsSearching(false);
  }, []);

  return {
    // State
    isSearching,
    result,
    error,

    // Actions
    executeSearch,
    reset,
    getProviderRegistry,
  };
}
