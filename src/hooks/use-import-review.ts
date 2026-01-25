import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type ImportEntityType = "candidate" | "contact" | "org_node" | "note";
export type ImportEntityStatus = "pending_review" | "approved" | "rejected" | "needs_input";

export interface ImportEntity {
  id: string;
  batch_id: string;
  item_id: string | null;
  tenant_id: string;
  entity_type: ImportEntityType;
  status: ImportEntityStatus;
  extracted_json: Record<string, unknown>;
  edited_json: Record<string, unknown> | null;
  confidence: number;
  missing_fields: string[];
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_record_id: string | null;
  created_record_type: string | null;
  duplicate_of_id: string | null;
  duplicate_of_type: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  file_name?: string;
}

export interface ImportBatchDetails {
  id: string;
  tenant_id: string;
  status: string;
  total_files: number;
  processed_files: number;
  success_count: number;
  fail_count: number;
  created_at: string;
  completed_at: string | null;
}

interface ApprovalResult {
  success: boolean;
  recordId?: string;
  recordType?: string;
  error?: string;
}

export function useImportReview(batchId: string | undefined) {
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(true);
  const [batch, setBatch] = useState<ImportBatchDetails | null>(null);
  const [entities, setEntities] = useState<ImportEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<ImportEntity | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch batch and entities
  const fetchBatchData = useCallback(async () => {
    if (!batchId) return;

    try {
      // Fetch batch details
      const { data: batchData, error: batchError } = await supabase
        .from("cv_import_batches")
        .select("*")
        .eq("id", batchId)
        .single();

      if (batchError) throw batchError;
      setBatch(batchData);

      // Fetch entities for this batch
      const { data: entitiesData, error: entitiesError } = await supabase
        .from("import_entities")
        .select(`
          *,
          cv_import_items(file_name)
        `)
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true });

      if (entitiesError) throw entitiesError;

      // Transform to include file_name
      const transformedEntities: ImportEntity[] = (entitiesData || []).map((e: any) => ({
        ...e,
        file_name: e.cv_import_items?.file_name,
      }));

      setEntities(transformedEntities);

      // Select first pending entity if none selected
      if (!selectedEntity || !transformedEntities.find(e => e.id === selectedEntity.id)) {
        const firstPending = transformedEntities.find(e => e.status === "pending_review");
        if (firstPending) {
          setSelectedEntity(firstPending);
        } else if (transformedEntities.length > 0) {
          setSelectedEntity(transformedEntities[0]);
        }
      }

      // Check if batch is still processing - if so, keep polling
      const stillProcessing = batchData.status === 'queued' || batchData.status === 'processing';
      setIsPolling(stillProcessing);

    } catch (error) {
      console.error("Failed to fetch batch data:", error);
      toast.error("Failed to load import data");
    } finally {
      setIsLoading(false);
    }
  }, [batchId, selectedEntity]);

  // Initial fetch
  useEffect(() => {
    fetchBatchData();
  }, [fetchBatchData]);

  // Polling for updates when batch is still processing
  useEffect(() => {
    if (!isPolling || !batchId) return;

    const interval = setInterval(() => {
      fetchBatchData();
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, batchId, fetchBatchData]);

  // Update entity fields
  const updateEntity = useCallback(async (
    entityId: string,
    updates: Partial<ImportEntity>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("import_entities")
        .update({
          edited_json: updates.edited_json as any,
          status: updates.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entityId);

      if (error) throw error;

      // Update local state
      setEntities(prev => prev.map(e =>
        e.id === entityId ? { ...e, ...updates } : e
      ));

      if (selectedEntity?.id === entityId) {
        setSelectedEntity(prev => prev ? { ...prev, ...updates } : null);
      }

      return true;
    } catch (error) {
      console.error("Failed to update entity:", error);
      toast.error("Failed to save changes");
      return false;
    }
  }, [selectedEntity]);

  // Approve a single entity - write to real table
  const approveEntity = useCallback(async (entityId: string): Promise<ApprovalResult> => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return { success: false, error: "Entity not found" };

    const data = entity.edited_json || entity.extracted_json;
    const tenantId = entity.tenant_id;

    try {
      let recordId: string | undefined;
      let recordType: string | undefined;

      // Write to appropriate table based on entity type
      if (entity.entity_type === "candidate") {
        // Write to candidates table
        const candidateData = {
          tenant_id: tenantId,
          name: (data as any).personal?.full_name || (data as any).name || "Unknown",
          email: (data as any).personal?.email,
          phone: (data as any).personal?.phone,
          location: (data as any).personal?.location,
          linkedin_url: (data as any).personal?.linkedin,
          headline: (data as any).headline?.current_title,
          current_title: (data as any).headline?.current_title,
          current_company: (data as any).headline?.current_company,
          skills: (data as any).skills || {},
          experience: (data as any).experience || [],
          education: (data as any).education || [],
          source: "import",
          status: "active",
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        };

        const { data: inserted, error } = await supabase
          .from("candidates")
          .insert(candidateData)
          .select("id")
          .single();

        if (error) throw error;
        recordId = inserted.id;
        recordType = "candidate";

      } else if (entity.entity_type === "contact") {
        // Write to contacts table
        const contactData = {
          team_id: tenantId,
          name: (data as any).name || (data as any).full_name || "Unknown",
          email: (data as any).email,
          phone: (data as any).phone,
          title: (data as any).title || (data as any).job_title,
          department: (data as any).department,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        };

        const { data: inserted, error } = await supabase
          .from("contacts")
          .insert(contactData)
          .select("id")
          .single();

        if (error) throw error;
        recordId = inserted.id;
        recordType = "contact";

      } else if (entity.entity_type === "note") {
        // Write to notes table
        const noteData = {
          team_id: tenantId,
          entity_type: "import",
          entity_id: entity.batch_id,
          content: (data as any).summary || (data as any).content || JSON.stringify(data),
          visibility: "team" as const,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        };

        const { data: inserted, error } = await supabase
          .from("notes")
          .insert(noteData)
          .select("id")
          .single();

        if (error) throw error;
        recordId = inserted.id;
        recordType = "note";
      }

      // Update entity status
      const { error: updateError } = await supabase
        .from("import_entities")
        .update({
          status: "approved",
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          created_record_id: recordId,
          created_record_type: recordType,
        })
        .eq("id", entityId);

      if (updateError) throw updateError;

      // Update local state
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, status: "approved" as ImportEntityStatus, created_record_id: recordId || null, created_record_type: recordType || null }
          : e
      ));

      toast.success(`Saved to ${recordType === "candidate" ? "Talent Database" : recordType === "contact" ? "Contacts" : "Notes"}`);
      return { success: true, recordId, recordType };

    } catch (error) {
      console.error("Failed to approve entity:", error);
      toast.error("Failed to approve entity");
      return { success: false, error: String(error) };
    }
  }, [entities]);

  // Reject an entity
  const rejectEntity = useCallback(async (entityId: string, reason?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("import_entities")
        .update({
          status: "rejected",
          rejected_reason: reason,
        })
        .eq("id", entityId);

      if (error) throw error;

      setEntities(prev => prev.map(e =>
        e.id === entityId ? { ...e, status: "rejected" as ImportEntityStatus, rejected_reason: reason || null } : e
      ));

      toast.info("Entity rejected");
      return true;
    } catch (error) {
      console.error("Failed to reject entity:", error);
      toast.error("Failed to reject entity");
      return false;
    }
  }, []);

  // Approve all entities that have required fields
  const approveAll = useCallback(async (): Promise<{ approved: number; skipped: number }> => {
    const pending = entities.filter(e => e.status === "pending_review");
    let approved = 0;
    let skipped = 0;

    for (const entity of pending) {
      const data = entity.edited_json || entity.extracted_json;
      const name = (data as any).personal?.full_name || (data as any).name;

      // Check required fields
      if (!name && entity.entity_type !== "note") {
        // Mark as needs_input
        await supabase
          .from("import_entities")
          .update({ status: "needs_input" })
          .eq("id", entity.id);
        skipped++;
        continue;
      }

      const result = await approveEntity(entity.id);
      if (result.success) {
        approved++;
      } else {
        skipped++;
      }
    }

    // Refresh data
    await fetchBatchData();

    if (skipped > 0) {
      toast.warning(`${approved} approved, ${skipped} need input`);
    } else {
      toast.success(`All ${approved} entities approved!`);
    }

    return { approved, skipped };
  }, [entities, approveEntity, fetchBatchData]);

  // Get counts by status
  const statusCounts = {
    pending: entities.filter(e => e.status === "pending_review").length,
    approved: entities.filter(e => e.status === "approved").length,
    rejected: entities.filter(e => e.status === "rejected").length,
    needsInput: entities.filter(e => e.status === "needs_input").length,
    total: entities.length,
  };

  return {
    isLoading,
    batch,
    entities,
    selectedEntity,
    setSelectedEntity,
    statusCounts,
    updateEntity,
    approveEntity,
    rejectEntity,
    approveAll,
    refreshData: fetchBatchData,
  };
}
