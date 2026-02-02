import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { parseBooleanQuery, simpleQueryToTsquery, highlightMatches } from "@/lib/boolean-search-parser";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus, TalentCvSource } from "@/lib/types";

export interface BooleanSearchResult {
  candidate: Talent;
  rank: number;
  highlights: {
    name?: string;
    headline?: string;
    cvSnippet?: string;
    matchedTerms: string[];
  };
  // Match location indicators
  matchedIn: {
    cv: boolean;
    skills: boolean;
    overview: boolean;
  };
}

interface RawSearchResult {
  id: string;
  name: string;
  email: string | null;
  headline: string | null;
  current_title: string | null;
  location: string | null;
  skills: unknown;
  rank: number;
  highlight_name: string | null;
  highlight_headline: string | null;
  highlight_cv: string | null;
}

interface UseBooleanSearchOptions {
  enabled?: boolean;
  debounceMs?: number;
}

type SearchMode = "simple" | "boolean";

export function useBooleanSearch(options: UseBooleanSearchOptions = {}) {
  const { enabled = true, debounceMs = 500 } = options;
  const { currentWorkspace } = useWorkspace();
  
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("simple");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const isBooleanMode = mode === "boolean";

  // Parse the query
  const parsedQuery = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return { tsquery: "", terms: [], isValid: true };
    }
    
    if (isBooleanMode) {
      return parseBooleanQuery(debouncedQuery);
    } else {
      // Simple mode: treat as space-separated AND
      const tsquery = simpleQueryToTsquery(debouncedQuery);
      const terms = debouncedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      return { tsquery, terms, isValid: true };
    }
  }, [debouncedQuery, isBooleanMode]);

  // Execute search query
  const searchQuery = useQuery({
    queryKey: ["boolean-search", currentWorkspace?.id, parsedQuery.tsquery],
    queryFn: async (): Promise<BooleanSearchResult[]> => {
      if (!parsedQuery.tsquery || !parsedQuery.isValid) {
        return [];
      }

      console.log("[useBooleanSearch] Searching with tsquery:", parsedQuery.tsquery);

      // Use raw SQL query via RPC for full-text search
      const { data, error } = await supabase.rpc("search_candidates", {
        query_text: query, // Pass original query for plainto_tsquery
        workspace_id: currentWorkspace?.id ?? null,
      });

      if (error) {
        console.error("[useBooleanSearch] Search error:", error);
        throw error;
      }

      // Transform results
      const results: BooleanSearchResult[] = (data as RawSearchResult[] || []).map((row) => {
        // Extract skills
        let skills: string[] = [];
        if (row.skills) {
          const skillsData = row.skills as Record<string, unknown>;
          if (Array.isArray(skillsData)) {
            skills = skillsData as string[];
          } else if (Array.isArray(skillsData.primary_skills)) {
            skills = skillsData.primary_skills as string[];
          }
        }

        const candidate: Talent = {
          id: row.id,
          name: row.name,
          email: row.email || "",
          phone: "",
          skills,
          roleType: row.current_title || row.headline || "Unknown",
          seniority: "mid",
          availability: "available" as TalentAvailability,
          dataQuality: "parsed" as TalentDataQuality,
          status: "active" as TalentStatus,
          cvSource: "upload" as TalentCvSource,
          aiOverview: row.headline || undefined,
          location: row.location || undefined,
        };

        // Determine where matches were found
        const matchedIn = {
          cv: Boolean(row.highlight_cv),
          skills: skills.some(skill => 
            parsedQuery.terms.some(term => 
              skill.toLowerCase().includes(term.toLowerCase())
            )
          ),
          overview: Boolean(row.highlight_headline),
        };

        return {
          candidate,
          rank: row.rank,
          highlights: {
            name: row.highlight_name || undefined,
            headline: row.highlight_headline || undefined,
            cvSnippet: row.highlight_cv || undefined,
            matchedTerms: parsedQuery.terms,
          },
          matchedIn,
        };
      });

      console.log("[useBooleanSearch] Found", results.length, "results");
      return results;
    },
    enabled: enabled && !!parsedQuery.tsquery && parsedQuery.isValid && !!currentWorkspace?.id,
    staleTime: 30000, // Cache for 30s
  });

  // Toggle Boolean mode
  const toggleBooleanMode = useCallback(() => {
    setMode((prev) => (prev === "boolean" ? "simple" : "boolean"));
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery("");
  }, []);

  // Highlight helper for rendering
  const getHighlightedText = useCallback(
    (text: string) => {
      return highlightMatches(text, parsedQuery.terms);
    },
    [parsedQuery.terms]
  );

  // Manual trigger (for Enter key)
  const triggerSearch = useCallback(() => {
    setDebouncedQuery(query);
  }, [query]);

  return {
    // State
    query,
    setQuery,
    mode,
    setMode,
    isBooleanMode,
    toggleBooleanMode,
    clearSearch,
    triggerSearch,
    
    // Parsed query info
    parsedQuery,
    isValidQuery: parsedQuery.isValid,
    parseError: parsedQuery.error,
    
    // Search results
    results: searchQuery.data || [],
    isSearching: searchQuery.isLoading,
    searchError: searchQuery.error,
    
    // Helpers
    getHighlightedText,
    hasResults: (searchQuery.data?.length ?? 0) > 0,
    isActive: query.trim().length > 0,
  };
}
