import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SavedSearch {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  query_string: string;
  mode: "simple" | "boolean";
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
}

interface CreateSavedSearchInput {
  name: string;
  description?: string;
  query_string: string;
  mode: "simple" | "boolean";
}

export function useSavedSearches() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch saved searches for current user/workspace
  const { data: savedSearches = [], isLoading } = useQuery({
    queryKey: ["saved-searches", currentWorkspace?.id, user?.id],
    queryFn: async (): Promise<SavedSearch[]> => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .eq("user_id", user.id)
        .order("last_run_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("[useSavedSearches] Fetch error:", error);
        throw error;
      }

      return (data || []) as SavedSearch[];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    staleTime: 30000,
  });

  // Create a new saved search
  const createMutation = useMutation({
    mutationFn: async (input: CreateSavedSearchInput) => {
      if (!currentWorkspace?.id || !user?.id) {
        throw new Error("No workspace or user");
      }

      const { data, error } = await supabase
        .from("saved_searches")
        .insert({
          user_id: user.id,
          workspace_id: currentWorkspace.id,
          name: input.name,
          description: input.description || null,
          query_string: input.query_string,
          mode: input.mode,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search saved successfully");
      setIsModalOpen(false);
    },
    onError: (error) => {
      console.error("[useSavedSearches] Create error:", error);
      toast.error("Failed to save search");
    },
  });

  // Update last_run_at when a saved search is executed
  const updateLastRunMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const { error } = await supabase
        .from("saved_searches")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", searchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  // Delete a saved search
  const deleteMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", searchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search deleted");
    },
    onError: (error) => {
      console.error("[useSavedSearches] Delete error:", error);
      toast.error("Failed to delete search");
    },
  });

  return {
    savedSearches,
    isLoading,
    isModalOpen,
    setIsModalOpen,
    createSearch: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateLastRun: updateLastRunMutation.mutate,
    deleteSearch: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
