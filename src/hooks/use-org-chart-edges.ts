import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inferSeniority, SENIORITY_ORDER } from "@/lib/seniority-inference";

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
 */
export function useOrgChartEdges({ companyId }: UseOrgChartEdgesOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["org-chart-edges", companyId];
  
  // Undo snapshot storage
  const [canUndo, setCanUndo] = useState(false);
  const undoSnapshotRef = useRef<OrgChartEdge[]>([]);

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
  const parentMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();
  let rootContactId: string | null = null;

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
    [edges]
  );

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
      if (parentContactId && wouldCreateCycle(childContactId, parentContactId)) {
        throw new Error("Cycle detected");
      }
      if (parentContactId === null && rootContactId && rootContactId !== childContactId) {
        await supabase
          .from("org_chart_edges" as any)
          .update({ parent_contact_id: childContactId, position_index: 0 } as any)
          .eq("company_id", companyId)
          .eq("child_contact_id", rootContactId);
      }
      let idx = positionIndex ?? 0;
      if (positionIndex === undefined && parentContactId !== null) {
        const existingSiblings = sortedEdges.filter(
          e => e.parent_contact_id === parentContactId && e.child_contact_id !== childContactId
        );
        idx = existingSiblings.length;
      }
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
      const targetEdge = sortedEdges.find(e => e.child_contact_id === targetContactId);
      if (!targetEdge) throw new Error("Target not in tree");
      const targetParentId = targetEdge.parent_contact_id;
      if (targetParentId && wouldCreateCycle(draggedContactId, targetParentId)) {
        throw new Error("Cycle detected");
      }
      const siblings = sortedEdges
        .filter(e => e.parent_contact_id === targetParentId && e.child_contact_id !== draggedContactId)
        .sort((a, b) => a.position_index - b.position_index);
      const targetIdx = siblings.findIndex(e => e.child_contact_id === targetContactId);
      const insertAt = side === "before" ? targetIdx : targetIdx + 1;
      const newOrder: string[] = siblings.map(e => e.child_contact_id);
      newOrder.splice(insertAt, 0, draggedContactId);
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
      if (wouldCreateCycle(draggedContactId, targetContactId)) {
        throw new Error("Cycle detected");
      }
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

  /**
   * Auto-arrange contacts by seniority: CEO at root, then all others as siblings sorted by seniority.
   * Saves a snapshot of current edges for undo.
   */
  const autoArrangeBySeniority = useMutation({
    mutationFn: async (contacts: { id: string; title: string }[]) => {
      if (!companyId || contacts.length === 0) throw new Error("No company or contacts");

      // Save snapshot for undo
      undoSnapshotRef.current = [...edges];

      // Sort contacts by seniority (most senior first)
      const ranked = contacts
        .map(c => ({
          id: c.id,
          seniority: inferSeniority(c.title),
          order: SENIORITY_ORDER[inferSeniority(c.title)],
          title: c.title,
        }))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

      // Delete all existing edges for this company
      await supabase
        .from("org_chart_edges" as any)
        .delete()
        .eq("company_id", companyId);

      // Most senior = root (parent_contact_id = null)
      const rootId = ranked[0].id;
      await supabase
        .from("org_chart_edges" as any)
        .insert({
          company_id: companyId,
          child_contact_id: rootId,
          parent_contact_id: null,
          position_index: 0,
        } as any);

      // All others = siblings under root, ordered by seniority
      for (let i = 1; i < ranked.length; i++) {
        await supabase
          .from("org_chart_edges" as any)
          .insert({
            company_id: companyId,
            child_contact_id: ranked[i].id,
            parent_contact_id: rootId,
            position_index: i - 1,
          } as any);
      }
    },
    onSuccess: () => {
      setCanUndo(true);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /**
   * Undo auto-arrange: restore the previous edge snapshot.
   */
  const undoAutoArrange = useMutation({
    mutationFn: async () => {
      if (!companyId || undoSnapshotRef.current.length === 0) throw new Error("Nothing to undo");

      // Delete current edges
      await supabase
        .from("org_chart_edges" as any)
        .delete()
        .eq("company_id", companyId);

      // Restore snapshot
      for (const edge of undoSnapshotRef.current) {
        await supabase
          .from("org_chart_edges" as any)
          .insert({
            company_id: companyId,
            child_contact_id: edge.child_contact_id,
            parent_contact_id: edge.parent_contact_id,
            position_index: edge.position_index,
          } as any);
      }
    },
    onSuccess: () => {
      setCanUndo(false);
      undoSnapshotRef.current = [];
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
    autoArrangeBySeniority: autoArrangeBySeniority.mutateAsync,
    undoAutoArrange: undoAutoArrange.mutateAsync,
    canUndo,
    isAutoArranging: autoArrangeBySeniority.isPending,
  };
}
