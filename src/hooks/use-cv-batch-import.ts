import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type BatchStatus = "queued" | "processing" | "completed" | "failed" | "partial";
export type ItemStatus = "queued" | "processing" | "parsed" | "dedupe_review" | "merged" | "failed";

export interface CVImportBatch {
  id: string;
  tenant_id: string;
  created_by_user_id: string;
  source: "ui_upload" | "background_import";
  status: BatchStatus;
  total_files: number;
  processed_files: number;
  success_count: number;
  fail_count: number;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CVImportItem {
  id: string;
  tenant_id: string;
  batch_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string | null;
  checksum_sha256: string | null;
  status: ItemStatus;
  parse_confidence: number | null;
  candidate_id: string | null;
  dedupe_candidate_ids: string[] | null;
  error_message: string | null;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface CreateBatchResult {
  batch: CVImportBatch;
  uploadPath: string;
  maxConcurrentUploads: number;
}

interface ItemsPaginationResult {
  items: CVImportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// SHA-256 hash function for deduplication
async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCVBatchImport() {
  const { currentWorkspace } = useWorkspace();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ uploaded: number; total: number }>({ uploaded: 0, total: 0 });
  const [currentBatch, setCurrentBatch] = useState<CVImportBatch | null>(null);
  const [items, setItems] = useState<CVImportItem[]>([]);
  const [itemsPagination, setItemsPagination] = useState<ItemsPaginationResult["pagination"] | null>(null);

  const createBatch = useCallback(async (totalFiles: number): Promise<CreateBatchResult | null> => {
    if (!currentWorkspace) {
      toast.error("No workspace selected");
      return null;
    }

    setIsCreatingBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke("cv-batch-import", {
        body: { totalFiles, source: "ui_upload" },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to create batch");
      }

      setCurrentBatch(data.data.batch);
      return data.data;
    } catch (error) {
      console.error("Failed to create batch:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create batch");
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  }, [currentWorkspace]);

  const uploadFiles = useCallback(async (
    files: File[],
    batchId: string,
    uploadPath: string,
    maxConcurrent: number = 5
  ): Promise<boolean> => {
    if (!currentWorkspace) {
      toast.error("No workspace selected");
      return false;
    }

    setIsUploading(true);
    setUploadProgress({ uploaded: 0, total: files.length });

    const tenantId = currentWorkspace.id;
    let successCount = 0;
    let failCount = 0;

    // Process files in batches for concurrency control
    const processFile = async (file: File, index: number): Promise<void> => {
      try {
        // Compute checksum
        const checksum = await computeSHA256(file);
        
        // Upload to storage
        const storagePath = `${uploadPath}/${checksum}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cv-uploads")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // If file already exists, that's okay (dedup by checksum)
          if (!uploadError.message.includes("already exists")) {
            throw uploadError;
          }
        }

        // Create item record
        const { error: itemError } = await supabase
          .from("cv_import_items")
          .insert({
            tenant_id: tenantId,
            batch_id: batchId,
            file_name: file.name,
            file_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
            storage_path: storagePath,
            checksum_sha256: checksum,
            status: "queued",
          });

        if (itemError) {
          throw itemError;
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        failCount++;
      }

      setUploadProgress({ uploaded: successCount + failCount, total: files.length });
    };

    // Process with concurrency limit
    const chunks: File[][] = [];
    for (let i = 0; i < files.length; i += maxConcurrent) {
      chunks.push(files.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map((file, idx) => processFile(file, idx)));
    }

    setIsUploading(false);

    if (failCount > 0) {
      toast.warning(`Uploaded ${successCount} files, ${failCount} failed`);
    } else {
      toast.success(`Uploaded ${successCount} files successfully`);
    }

    return failCount === 0;
  }, [currentWorkspace]);

  const completeUpload = useCallback(async (batchId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("cv-batch-import", {
        body: { batchId },
        method: "POST",
        headers: {
          "x-action": "complete-upload",
        },
      });

      // Use REST endpoint directly since invoke doesn't support path routing well
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-batch-import/${batchId}/complete-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to start processing");
      }

      setCurrentBatch(result.data);
      toast.success("Processing started");
      return true;
    } catch (error) {
      console.error("Failed to complete upload:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start processing");
      return false;
    }
  }, []);

  const fetchBatch = useCallback(async (batchId: string): Promise<CVImportBatch | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-batch-import/${batchId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setCurrentBatch(result.data);
      return result.data;
    } catch (error) {
      console.error("Failed to fetch batch:", error);
      return null;
    }
  }, []);

  const fetchItems = useCallback(async (
    batchId: string,
    page: number = 1,
    limit: number = 50,
    statusFilter?: ItemStatus
  ): Promise<ItemsPaginationResult | null> => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-batch-import/${batchId}/items?${params}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setItems(result.data.items);
      setItemsPagination(result.data.pagination);
      return result.data;
    } catch (error) {
      console.error("Failed to fetch items:", error);
      return null;
    }
  }, []);

  const retryItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-batch-import/items/${itemId}/retry`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Retry initiated");
      return true;
    } catch (error) {
      console.error("Failed to retry item:", error);
      toast.error(error instanceof Error ? error.message : "Failed to retry");
      return false;
    }
  }, []);

  const resolveDedupe = useCallback(async (
    itemId: string,
    action: "create_new" | "merge_into" | "link_existing",
    candidateId?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cv-batch-import/items/${itemId}/resolve-dedupe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ action, candidateId }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Duplicate resolved");
      return true;
    } catch (error) {
      console.error("Failed to resolve dedupe:", error);
      toast.error(error instanceof Error ? error.message : "Failed to resolve");
      return false;
    }
  }, []);

  return {
    // State
    isCreatingBatch,
    isUploading,
    uploadProgress,
    currentBatch,
    items,
    itemsPagination,
    // Actions
    createBatch,
    uploadFiles,
    completeUpload,
    fetchBatch,
    fetchItems,
    retryItem,
    resolveDedupe,
  };
}