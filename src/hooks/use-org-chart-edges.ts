import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgChartEdge {
  id: string;
  company_id: string;
  child_contact_id: string;
  parent_contact_id: string | null;
  position_index: number;
}

interface UseOrgChartEdgesOptions {
  companyId: string | undefined;
}

/**
 * Hook to manage org_chart_edges as the single source of truth for hierarchy.
 * Reads/writes to the org_chart_edges table. Canvas connectors are rendered
 * ONLY from these edges, never from UI state.
 */
export function useOrgChartEdges({ companyId }: UseOrgChartEdgesOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["org-chart-edges", companyId];

  // Fetch all edges for this company
  const { data: edges = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("org_chart_edges" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("position_index");
      if (error) {
        console.error("Error fetching org chart edges:", error);
        return [];
      }
      return (data || []) as unknown as OrgChartEdge[];
    },
    enabled: !!companyId,
  });

  // Build parent/children maps from edges
  const parentMap = new Map<string, string | null>(); // child -> parent
  const childrenMap = new Map<string, string[]>(); // parent -> children
  let rootContactId: string | null = null;

  edges.forEach((edge) => {
    parentMap.set(edge.child_contact_id, edge.parent_contact_id);
    if (edge.parent_contact_id) {
      if (!childrenMap.has(edge.parent_contact_id)) {
        childrenMap.set(edge.parent_contact_id, []);
      }
      childrenMap.get(edge.parent_contact_id)!.push(edge.child_contact_id);
    }
    if (edge.parent_contact_id === null) {
      rootContactId = edge.child_contact_id;
    }
  });

  // Cycle detection: walk from child to ancestors, check if newParent would create a loop
  const wouldCreateCycle = useCallback(
    (childId: string, newParentId: string): boolean => {
      const visited = new Set<string>();
      let current: string | null | undefined = newParentId;
      while (current) {
        if (current === childId) return true;
        if (visited.has(current)) return false; // already checked
        visited.add(current);
        current = parentMap.get(current) ?? undefined;
      }
      return false;
    },
    [edges] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Set parent (upsert edge). Handles root replacement rule.
  const setParentMutation = useMutation({
    mutationFn: async ({
      childContactId,
      parentContactId,
    }: {
      childContactId: string;
      parentContactId: string | null;
    }) => {
      if (!companyId) throw new Error("No company");

      // Validate no cycles
      if (parentContactId && wouldCreateCycle(childContactId, parentContactId)) {
        throw new Error("Cycle detected");
      }

      // If setting as root (parentContactId=null), handle root replacement
      if (parentContactId === null && rootContactId && rootContactId !== childContactId) {
        // Old root becomes child of new root
        await supabase
          .from("org_chart_edges" as any)
          .update({ parent_contact_id: childContactId, position_index: 0 } as any)
          .eq("company_id", companyId)
          .eq("child_contact_id", rootContactId);
      }

      // Upsert the child's edge
      const { error } = await supabase
        .from("org_chart_edges" as any)
        .upsert(
          {
            company_id: companyId,
            child_contact_id: childContactId,
            parent_contact_id: parentContactId,
            position_index: 0,
          } as any,
          { onConflict: "company_id,child_contact_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Remove a contact from the tree entirely
  const removeEdgeMutation = useMutation({
    mutationFn: async ({ childContactId }: { childContactId: string }) => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase
        .from("org_chart_edges" as any)
        .delete()
        .eq("company_id", companyId)
        .eq("child_contact_id", childContactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    edges,
    isLoading,
    parentMap,
    childrenMap,
    rootContactId,
    setParent: setParentMutation.mutateAsync,
    removeEdge: removeEdgeMutation.mutateAsync,
    wouldCreateCycle,
  };
}
