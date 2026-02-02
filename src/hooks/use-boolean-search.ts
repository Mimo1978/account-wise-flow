import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { parseBooleanQuery, simpleQueryToTsquery, highlightMatches } from "@/lib/boolean-search-parser";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus, TalentCvSource } from "@/lib/types";

export type MatchQuality = "strong" | "good" | "partial";

export interface MatchBreakdown {
  title: boolean;
  skills: boolean;
  overview: boolean;
  location: boolean;
  cv: boolean;
  title_score: number;
  skills_score: number;
  overview_score: number;
  location_score: number;
  cv_score: number;
}

export interface BooleanSearchResult {
  candidate: Talent;
  rank: number;
  matchScore: number;
  matchQuality: MatchQuality;
  matchBreakdown: MatchBreakdown;
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
    title: boolean;
    location: boolean;
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
  match_score: number;
  match_breakdown: unknown;
  highlight_name: string | null;
  highlight_headline: string | null;
  highlight_cv: string | null;
}

interface UseBooleanSearchOptions {
  enabled?: boolean;
  debounceMs?: number;
}

type SearchMode = "simple" | "boolean";

/**
 * Determine match quality from score
 * Strong: 70+, Good: 40-69, Partial: <40
 */
function getMatchQuality(score: number): MatchQuality {
  if (score >= 70) return "strong";
  if (score >= 40) return "good";
  return "partial";
}

/**
 * Count matched fields from breakdown
 */
function countMatchedFields(breakdown: MatchBreakdown): number {
  let count = 0;
  if (breakdown.title) count++;
  if (breakdown.skills) count++;
  if (breakdown.overview) count++;
  if (breakdown.location) count++;
  if (breakdown.cv) count++;
  return count;
}

/**
 * Get human-readable match summary
 */
export function getMatchSummary(breakdown: MatchBreakdown): string {
  const parts: string[] = [];
  if (breakdown.title) parts.push("title");
  if (breakdown.skills) parts.push("skills");
  if (breakdown.overview) parts.push("overview");
  if (breakdown.location) parts.push("location");
  if (breakdown.cv) parts.push("CV");
  
  if (parts.length === 0) return "No specific matches";
  return `Matched in: ${parts.join(", ")}`;
}

export function useBooleanSearch(options: UseBooleanSearchOptions = {}) {
  const { enabled = true, debounceMs = 500 } = options;
  const { currentWorkspace } = useWorkspace();
  
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("simple");
  const [includeCv, setIncludeCv] = useState(false);
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
    queryKey: ["boolean-search", currentWorkspace?.id, parsedQuery.tsquery, isBooleanMode, includeCv],
    queryFn: async (): Promise<BooleanSearchResult[]> => {
      if (!parsedQuery.tsquery || !parsedQuery.isValid) {
        return [];
      }

      console.log("[useBooleanSearch] Searching with tsquery:", parsedQuery.tsquery, "mode:", isBooleanMode ? "boolean" : "simple", "includeCv:", includeCv);

      // Use RPC for full-text search with enhanced ranking
      const { data, error } = await supabase.rpc("search_candidates", {
        query_text: isBooleanMode ? parsedQuery.tsquery : debouncedQuery,
        workspace_id: currentWorkspace?.id ?? null,
        use_tsquery: isBooleanMode,
        include_cv: includeCv,
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

        // Parse match breakdown with defaults
        const rawBreakdown = row.match_breakdown as Record<string, unknown> | null;
        const breakdown: MatchBreakdown = {
          title: Boolean(rawBreakdown?.title),
          skills: Boolean(rawBreakdown?.skills),
          overview: Boolean(rawBreakdown?.overview),
          location: Boolean(rawBreakdown?.location),
          cv: Boolean(rawBreakdown?.cv),
          title_score: Number(rawBreakdown?.title_score) || 0,
          skills_score: Number(rawBreakdown?.skills_score) || 0,
          overview_score: Number(rawBreakdown?.overview_score) || 0,
          location_score: Number(rawBreakdown?.location_score) || 0,
          cv_score: Number(rawBreakdown?.cv_score) || 0,
        };

        const matchScore = row.match_score || (row.rank * 100);
        const matchQuality = getMatchQuality(matchScore);

        // Determine where matches were found from breakdown
        const matchedIn = {
          title: breakdown.title,
          skills: breakdown.skills,
          overview: breakdown.overview,
          location: breakdown.location,
          cv: breakdown.cv,
        };

        return {
          candidate,
          rank: row.rank,
          matchScore,
          matchQuality,
          matchBreakdown: breakdown,
          highlights: {
            name: row.highlight_name || undefined,
            headline: row.highlight_headline || undefined,
            cvSnippet: row.highlight_cv || undefined,
            matchedTerms: parsedQuery.terms,
          },
          matchedIn,
        };
      });

      console.log("[useBooleanSearch] Found", results.length, "results, sorted by match score");
      return results;
    },
    enabled: enabled && !!parsedQuery.tsquery && parsedQuery.isValid && !!currentWorkspace?.id,
    staleTime: 30000, // Cache for 30s
  });

  // Toggle Boolean mode
  const toggleBooleanMode = useCallback(() => {
    setMode((prev) => (prev === "boolean" ? "simple" : "boolean"));
  }, []);

  // Toggle Include CV
  const toggleIncludeCv = useCallback(() => {
    setIncludeCv((prev) => !prev);
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
    includeCv,
    setIncludeCv,
    toggleIncludeCv,
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
    getMatchSummary,
    hasResults: (searchQuery.data?.length ?? 0) > 0,
    isActive: query.trim().length > 0,
  };
}
