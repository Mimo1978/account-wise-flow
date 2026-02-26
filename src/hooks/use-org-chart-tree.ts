import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgNode {
  id: string;
  companyId: string;
  contactId: string;
  parentContactId: string | null;
  siblingOrder: number;
}

/**
 * Fetches the full org-chart tree for a company from org_chart_edges.
 * Returns a flat list of OrgNode objects; the tree structure is derived
 * from parentContactId references.
 */
export function useOrgChartTree(companyId: string | null | undefined) {
  const queryClient = useQueryClient();

  const queryKey = ["org-chart-tree", companyId];

  const { data: nodes = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<OrgNode[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("org_chart_edges")
        .select("id, company_id, child_contact_id, parent_contact_id, position_index")
        .eq("company_id", companyId)
        .order("position_index", { ascending: true });

      if (error) {
        console.error("Failed to load org chart tree:", error);
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        companyId: row.company_id,
        contactId: row.child_contact_id,
        parentContactId: row.parent_contact_id,
        siblingOrder: row.position_index,
      }));
    },
    enabled: !!companyId,
  });

  /**
   * setParent – move a contact to a new parent (or to top-level if newParentContactId is null).
   */
  const setParentMutation = useMutation({
    mutationFn: async ({
      contactId,
      newParentContactId,
      newSiblingOrder = 0,
    }: {
      contactId: string;
      newParentContactId: string | null;
      newSiblingOrder?: number;
    }) => {
      if (!companyId) throw new Error("No company selected");

      // Upsert the moved node
      const { error } = await supabase
        .from("org_chart_edges")
        .upsert(
          {
            company_id: companyId,
            child_contact_id: contactId,
            parent_contact_id: newParentContactId,
            position_index: newSiblingOrder,
          },
          { onConflict: "company_id,child_contact_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /**
   * Ensure a contact exists in the org tree.
   * If the contact has no row yet, insert it under the given parent.
   */
  const ensureNodeMutation = useMutation({
    mutationFn: async ({
      contactId,
      parentContactId,
      siblingOrder = 0,
    }: {
      contactId: string;
      parentContactId: string | null;
      siblingOrder?: number;
    }) => {
      if (!companyId) throw new Error("No company selected");

      const { error } = await supabase
        .from("org_chart_edges")
        .upsert(
          {
            company_id: companyId,
            child_contact_id: contactId,
            parent_contact_id: parentContactId,
            position_index: siblingOrder,
          },
          { onConflict: "company_id,child_contact_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /**
   * Remove a node from the org chart.
   * Children of the removed node are reparented to the removed node's parent.
   */
  const removeNodeMutation = useMutation({
    mutationFn: async ({ contactId }: { contactId: string }) => {
      if (!companyId) throw new Error("No company selected");

      const removedNode = nodes.find((n) => n.contactId === contactId);
      if (!removedNode) return;

      // Reparent children to removed node's parent
      const children = nodes.filter((n) => n.parentContactId === contactId);
      for (const child of children) {
        const { error } = await supabase
          .from("org_chart_edges")
          .update({ parent_contact_id: removedNode.parentContactId })
          .eq("company_id", companyId)
          .eq("child_contact_id", child.contactId);

        if (error) throw error;
      }

      // Delete the node itself
      const { error } = await supabase
        .from("org_chart_edges")
        .delete()
        .eq("company_id", companyId)
        .eq("child_contact_id", contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Build a parentMap for convenience: contactId → parentContactId
  const parentMap = new Map<string, string | null>();
  for (const node of nodes) {
    parentMap.set(node.contactId, node.parentContactId);
  }

  return {
    nodes,
    parentMap,
    isLoading,
    error,
    setParent: setParentMutation.mutateAsync,
    ensureNode: ensureNodeMutation.mutateAsync,
    removeNode: removeNodeMutation.mutateAsync,
    isUpdating:
      setParentMutation.isPending ||
      ensureNodeMutation.isPending ||
      removeNodeMutation.isPending,
  };
}
