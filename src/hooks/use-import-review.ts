import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type ImportEntityType = "candidate" | "contact" | "org_node" | "note";
export type ImportEntityStatus = "pending_review" | "approved" | "rejected" | "needs_input";
export type StoreDestination = "candidate" | "contact" | "both";

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

export interface DuplicateMatch {
  id: string;
  name: string;
  email?: string;
  type: "candidate" | "contact";
  matchReason: string;
  matchScore: number;
}

export interface ApprovalOptions {
  destination: StoreDestination;
  companyId?: string;
  companyName?: string;
  createNewCompany?: boolean;
  addToOrgChart?: boolean;
  mergeWithExisting?: string;
  mergeType?: "candidate" | "contact";
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

export interface ApprovalResult {
  success: boolean;
  candidateId?: string;
  contactId?: string;
  companyId?: string;
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

  // Check for duplicate matches
  const checkDuplicates = useCallback(async (entity: ImportEntity): Promise<DuplicateMatch[]> => {
    const data = entity.edited_json || entity.extracted_json;
    const email = (data as any).personal?.email || (data as any).email;
    const linkedin = (data as any).personal?.linkedin || (data as any).linkedin;
    const phone = (data as any).personal?.phone || (data as any).phone;
    const name = (data as any).personal?.full_name || (data as any).name;

    const matches: DuplicateMatch[] = [];

    // Check candidates
    if (email || linkedin || phone) {
      let candidateQuery = supabase.from("candidates").select("id, name, email, linkedin_url, phone");
      
      const conditions: string[] = [];
      if (email) conditions.push(`email.eq.${email}`);
      if (linkedin) conditions.push(`linkedin_url.eq.${linkedin}`);
      
      const { data: candidateMatches } = await supabase
        .from("candidates")
        .select("id, name, email, linkedin_url, phone")
        .or(conditions.join(","));

      if (candidateMatches) {
        for (const match of candidateMatches) {
          let reason = "";
          let score = 0;
          
          if (email && match.email === email) {
            reason = "Email match";
            score = 0.95;
          } else if (linkedin && match.linkedin_url === linkedin) {
            reason = "LinkedIn match";
            score = 0.9;
          } else if (phone && match.phone === phone) {
            reason = "Phone match";
            score = 0.85;
          }
          
          if (reason) {
            matches.push({
              id: match.id,
              name: match.name,
              email: match.email || undefined,
              type: "candidate",
              matchReason: reason,
              matchScore: score,
            });
          }
        }
      }
    }

    // Check contacts
    if (email || phone) {
      const conditions: string[] = [];
      if (email) conditions.push(`email.eq.${email}`);
      
      const { data: contactMatches } = await supabase
        .from("contacts")
        .select("id, name, email, phone")
        .or(conditions.join(",") || "id.is.null");

      if (contactMatches && conditions.length > 0) {
        for (const match of contactMatches) {
          let reason = "";
          let score = 0;
          
          if (email && match.email === email) {
            reason = "Email match";
            score = 0.95;
          } else if (phone && match.phone === phone) {
            reason = "Phone match";
            score = 0.85;
          }
          
          if (reason) {
            matches.push({
              id: match.id,
              name: match.name,
              email: match.email || undefined,
              type: "contact",
              matchReason: reason,
              matchScore: score,
            });
          }
        }
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }, []);

  // Approve a single entity with options - write to real table(s)
  const approveEntity = useCallback(async (
    entityId: string,
    options: ApprovalOptions = { destination: "candidate" }
  ): Promise<ApprovalResult> => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return { success: false, error: "Entity not found" };

    const data = entity.edited_json || entity.extracted_json;
    const tenantId = entity.tenant_id;
    const userId = (await supabase.auth.getUser()).data.user?.id;

    try {
      let candidateId: string | undefined;
      let contactId: string | undefined;
      let companyId: string | undefined = options.companyId;

      // Handle company creation if needed
      if (options.createNewCompany && options.companyName) {
        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: options.companyName,
            team_id: tenantId,
            owner_id: userId,
          })
          .select("id")
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // Extract common fields
      const name = (data as any).personal?.full_name || (data as any).name || "Unknown";
      const email = (data as any).personal?.email || (data as any).email;
      const phone = (data as any).personal?.phone || (data as any).phone;
      const location = (data as any).personal?.location || (data as any).location;
      const linkedin = (data as any).personal?.linkedin || (data as any).linkedin;
      const title = (data as any).headline?.current_title || (data as any).title;

      // Handle merge with existing
      if (options.mergeWithExisting) {
        if (options.mergeType === "candidate") {
          // Update existing candidate
          const { error } = await supabase
            .from("candidates")
            .update({
              email: email || undefined,
              phone: phone || undefined,
              location: location || undefined,
              linkedin_url: linkedin || undefined,
              headline: title || undefined,
              skills: (data as any).skills || {},
              experience: (data as any).experience || [],
              education: (data as any).education || [],
              updated_at: new Date().toISOString(),
            })
            .eq("id", options.mergeWithExisting);

          if (error) throw error;
          candidateId = options.mergeWithExisting;
        } else if (options.mergeType === "contact") {
          // Update existing contact
          const { error } = await supabase
            .from("contacts")
            .update({
              email: email || undefined,
              phone: phone || undefined,
              title: title || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", options.mergeWithExisting);

          if (error) throw error;
          contactId = options.mergeWithExisting;
        }
      } else {
        // Create new records based on destination
        if (options.destination === "candidate" || options.destination === "both") {
          const candidateData = {
            tenant_id: tenantId,
            name,
            email,
            phone,
            location,
            linkedin_url: linkedin,
            headline: title,
            current_title: title,
            current_company: (data as any).headline?.current_company,
            skills: (data as any).skills || {},
            experience: (data as any).experience || [],
            education: (data as any).education || [],
            source: "import",
            status: "active",
            owner_id: userId,
          };

          const { data: inserted, error } = await supabase
            .from("candidates")
            .insert(candidateData)
            .select("id")
            .single();

          if (error) throw error;
          candidateId = inserted.id;
        }

        if (options.destination === "contact" || options.destination === "both") {
          const contactData = {
            team_id: tenantId,
            name,
            email,
            phone,
            title,
            department: (data as any).department,
            company_id: companyId || null,
            owner_id: userId,
          };

          const { data: inserted, error } = await supabase
            .from("contacts")
            .insert(contactData)
            .select("id")
            .single();

          if (error) throw error;
          contactId = inserted.id;
        }
      }

      // Determine record type for import_entities
      let recordType = options.destination;
      let recordId = candidateId || contactId;

      // Update entity status
      const { error: updateError } = await supabase
        .from("import_entities")
        .update({
          status: "approved",
          approved_by: userId,
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

      // Show success message
      const destinations: string[] = [];
      if (candidateId) destinations.push("Talent Database");
      if (contactId) destinations.push("Contacts");
      toast.success(`Saved to ${destinations.join(" & ")}`);

      return { success: true, candidateId, contactId, companyId };

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

  // Approve all entities that have required fields (defaults to candidate)
  const approveAll = useCallback(async (
    defaultOptions: ApprovalOptions = { destination: "candidate" }
  ): Promise<{ approved: number; skipped: number }> => {
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

      const result = await approveEntity(entity.id, defaultOptions);
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

  // Fetch companies for selector
  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");
    return data || [];
  }, []);

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
    checkDuplicates,
    fetchCompanies,
    refreshData: fetchBatchData,
  };
}
