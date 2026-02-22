import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus, TalentCvSource } from "@/lib/types";

interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  skills: unknown;
  experience: unknown;
  education: unknown;
  source: string | null;
  status: string | null;
  tenant_id: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  cv_storage_path: string | null;
  raw_cv_text: string | null;
}

// Transform database row to Talent type
function transformCandidate(row: CandidateRow): Talent {
  // Extract skills from various formats
  let skills: string[] = [];
  if (row.skills) {
    const skillsData = row.skills as Record<string, unknown>;
    if (Array.isArray(skillsData.primary_skills)) {
      skills = skillsData.primary_skills as string[];
    } else if (Array.isArray(skillsData)) {
      skills = skillsData as string[];
    }
  }

  // Determine availability based on status
  let availability: TalentAvailability = "available";
  if (row.status === "interviewing") {
    availability = "interviewing";
  } else if (row.status === "deployed" || row.status === "on-project") {
    availability = "deployed";
  }

  // Determine data quality
  const dataQuality: TalentDataQuality = row.source === "import" ? "parsed" : "needs-review";

  // Determine status
  let talentStatus: TalentStatus = "active";
  if (row.status === "new") talentStatus = "new";
  else if (row.status === "on-hold") talentStatus = "on-hold";
  else if (row.status === "archived") talentStatus = "archived";

  // Determine CV source
  let cvSource: TalentCvSource = "manual";
  if (row.source === "import" || row.source === "cv_upload") cvSource = "upload";
  else if (row.source === "linkedin") cvSource = "linkedin";
  else if (row.source === "image") cvSource = "image";

  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    skills,
    roleType: row.current_title || row.headline || "Unknown",
    seniority: "mid", // Default, could be inferred from title
    availability,
    rate: undefined,
    notes: undefined,
    aiOverview: row.headline || undefined,
    linkedIn: row.linkedin_url || undefined,
    location: row.location || undefined,
    lastUpdated: row.updated_at,
    dataQuality,
    status: talentStatus,
    cvSource,
    cvStoragePath: row.cv_storage_path || undefined,
    rawCvText: row.raw_cv_text || undefined,
  };
}

export function useCandidates() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["candidates", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      console.log("[useCandidates] Fetching candidates for workspace:", currentWorkspace.id);
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("tenant_id", currentWorkspace.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[useCandidates] Failed to fetch candidates:", error);
        throw error;
      }

      if (import.meta.env.DEV) {
        console.debug("[useCandidates] query:", { workspaceId: currentWorkspace.id, resultCount: data?.length ?? 0 });
      }
      return (data || []).map((row: any) => transformCandidate(row as CandidateRow));
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 0, // Always refetch when invalidated
    refetchOnWindowFocus: true,
  });

  // Function to invalidate candidates cache - call after approval
  const invalidateCandidates = () => {
    console.log("[useCandidates] Invalidating candidates cache");
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  // Function to optimistically add a candidate
  const addCandidateOptimistically = (candidate: Partial<Talent>) => {
    queryClient.setQueryData<Talent[]>(
      ["candidates", currentWorkspace?.id],
      (old) => {
        if (!old) return old;
        const newCandidate: Talent = {
          id: candidate.id || crypto.randomUUID(),
          name: candidate.name || "Unknown",
          email: candidate.email || "",
          phone: candidate.phone || "",
          skills: candidate.skills || [],
          roleType: candidate.roleType || "Unknown",
          seniority: candidate.seniority || "mid",
          availability: candidate.availability || "available",
          dataQuality: "parsed",
          status: "active",
          lastUpdated: new Date().toISOString(),
          ...candidate,
        };
        return [newCandidate, ...old];
      }
    );
  };

  return {
    candidates: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidateCandidates,
    addCandidateOptimistically,
  };
}

// Hook to get the query client for use outside of components
export function useCandidatesQueryClient() {
  return useQueryClient();
}
