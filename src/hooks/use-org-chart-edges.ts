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

/** Drop zone types for the 4-zone snap system */
export type DropZone = "top" | "bottom" | "left" | "right" | "company_root";

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
  const childrenMap = new Map<string, string[]>(); // parent -> children (sorted by position_index)
  let rootContactId: string | null = null;

  // Sort edges by position_index for consistent child ordering
  const sortedEdges = [...edges].sort((a, b) => a.position_index - b.position_index);

  sortedEdges.forEach((edge) => {
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
        if (visited.has(current)) return false;
        visited.add(current);
        current = parentMap.get(current) ?? undefined;
      }
      return false;
    },
    [edges] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Helper: reindex siblings under a parent to be contiguous 0..n-1
  const reindexSiblings = async (parentId: string | null) => {
    if (!companyId) return;
    const siblings = sortedEdges.filter(e => e.parent_contact_id === parentId);
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].position_index !== i) {
        await supabase
          .from("org_chart_edges" as any)
          .update({ position_index: i } as any)
          .eq("id", siblings[i].id);
      }
    }
  };

  // Set parent (upsert edge). Handles root replacement rule.
  const setParentMutation = useMutation({
    mutationFn: async ({
      childContactId,
      parentContactId,
      positionIndex,
    }: {
      childContactId: string;
      parentContactId: string | null;
      positionIndex?: number;
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

      // Determine position_index: use provided or append at end
      let idx = positionIndex ?? 0;
      if (positionIndex === undefined && parentContactId !== null) {
        const existingSiblings = sortedEdges.filter(
          e => e.parent_contact_id === parentContactId && e.child_contact_id !== childContactId
        );
        idx = existingSiblings.length;
      }

      // Upsert the child's edge
      const { error } = await supabase
        .from("org_chart_edges" as any)
        .upsert(
          {
            company_id: companyId,
            child_contact_id: childContactId,
            parent_contact_id: parentContactId,
            position_index: idx,
          } as any,
          { onConflict: "company_id,child_contact_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Insert as sibling: place dragged node next to target with same parent, shifting indices
  const insertAsSiblingMutation = useMutation({
    mutationFn: async ({
      draggedContactId,
      targetContactId,
      side,
    }: {
      draggedContactId: string;
      targetContactId: string;
      side: "before" | "after";
    }) => {
      if (!companyId) throw new Error("No company");

      // Find target's parent
      const targetEdge = sortedEdges.find(e => e.child_contact_id === targetContactId);
      if (!targetEdge) throw new Error("Target not in tree");

      const targetParentId = targetEdge.parent_contact_id;

      // Validate no cycles
      if (targetParentId && wouldCreateCycle(draggedContactId, targetParentId)) {
        throw new Error("Cycle detected");
      }

      // Get current siblings under target's parent (excluding dragged node)
      const siblings = sortedEdges
        .filter(e => e.parent_contact_id === targetParentId && e.child_contact_id !== draggedContactId)
        .sort((a, b) => a.position_index - b.position_index);

      // Find target's position in siblings list
      const targetIdx = siblings.findIndex(e => e.child_contact_id === targetContactId);
      const insertAt = side === "before" ? targetIdx : targetIdx + 1;

      // Build new ordering
      const newOrder: string[] = siblings.map(e => e.child_contact_id);
      newOrder.splice(insertAt, 0, draggedContactId);

      // Update all indices
      for (let i = 0; i < newOrder.length; i++) {
        await supabase
          .from("org_chart_edges" as any)
          .upsert(
            {
              company_id: companyId,
              child_contact_id: newOrder[i],
              parent_contact_id: targetParentId,
              position_index: i,
            } as any,
            { onConflict: "company_id,child_contact_id" }
          );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Insert dragged node as parent of target (TOP drop zone)
  const insertAsParentMutation = useMutation({
    mutationFn: async ({
      draggedContactId,
      targetContactId,
    }: {
      draggedContactId: string;
      targetContactId: string;
    }) => {
      if (!companyId) throw new Error("No company");

      const targetEdge = sortedEdges.find(e => e.child_contact_id === targetContactId);
      if (!targetEdge) throw new Error("Target not in tree");

      const targetOldParent = targetEdge.parent_contact_id;

      // Validate: dragged cannot be in target's subtree (would create cycle)
      if (wouldCreateCycle(draggedContactId, targetContactId)) {
        throw new Error("Cycle detected");
      }

      // 1. Place dragged node where target was (same parent, same position_index)
      await supabase
        .from("org_chart_edges" as any)
        .upsert(
          {
            company_id: companyId,
            child_contact_id: draggedContactId,
            parent_contact_id: targetOldParent,
            position_index: targetEdge.position_index,
          } as any,
          { onConflict: "company_id,child_contact_id" }
        );

      // 2. Make target a child of dragged
      await supabase
        .from("org_chart_edges" as any)
        .update({ parent_contact_id: draggedContactId, position_index: 0 } as any)
        .eq("company_id", companyId)
        .eq("child_contact_id", targetContactId);
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
    insertAsSibling: insertAsSiblingMutation.mutateAsync,
    insertAsParent: insertAsParentMutation.mutateAsync,
    removeEdge: removeEdgeMutation.mutateAsync,
    wouldCreateCycle,
  };
}
