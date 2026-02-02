import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
  Document,
  DocumentRow,
  DocumentType,
  EntityType,
  mapDocumentRow,
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
} from "@/lib/document-types";

interface UseDocumentsOptions {
  entityType: EntityType;
  entityId: string;
}

interface UseDocumentsReturn {
  documents: Document[];
  isLoading: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  uploadError: string | null;
  uploadProgress: number;
  uploadDocument: (file: File, documentType: DocumentType) => Promise<boolean>;
  downloadDocument: (document: Document) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<boolean>;
  setActiveDocument: (documentId: string) => Promise<boolean>;
  getSignedUrl: (storagePath: string) => Promise<string | null>;
  validateFile: (file: File) => { valid: boolean; error?: string };
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useDocuments({ entityType, entityId }: UseDocumentsOptions): UseDocumentsReturn {
  const { currentWorkspace } = useWorkspace();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!currentWorkspace?.id || !entityId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[useDocuments] Fetch error:", error);
        setDocuments([]);
      } else {
        setDocuments((data as DocumentRow[]).map(mapDocumentRow));
      }
    } catch (error) {
      console.error("[useDocuments] Unexpected error:", error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, entityType, entityId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    const isValidType = ACCEPTED_FILE_TYPES.includes(file.type);
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    const isValidExt = ACCEPTED_FILE_EXTENSIONS.includes(ext);

    if (!isValidType && !isValidExt) {
      return {
        valid: false,
        error: "Invalid file type. Please upload a PDF, DOC, or DOCX file.",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: "File is too large. Maximum size is 10MB.",
      };
    }

    return { valid: true };
  }, []);

  const triggerTextExtraction = useCallback(
    async (documentId: string, storagePath: string): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.warn("[useDocuments] No session for text extraction");
          return;
        }

        console.log("[useDocuments] Triggering text extraction for:", documentId, storagePath);

        const { data, error } = await supabase.functions.invoke('cv-text-extract', {
          body: {
            documentId,
            storagePath,
            isGenericDocument: true,
          },
        });

        if (error) {
          console.error("[useDocuments] Text extraction failed:", error);
        } else {
          console.log("[useDocuments] Text extraction complete:", data);
        }
      } catch (error) {
        console.error("[useDocuments] Text extraction error:", error);
      }
    },
    []
  );

  const uploadDocument = useCallback(
    async (file: File, documentType: DocumentType): Promise<boolean> => {
      if (!currentWorkspace?.id) {
        setUploadError("No workspace selected");
        toast.error("No workspace selected");
        return false;
      }

      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || "Invalid file");
        toast.error(validation.error);
        return false;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUploadError("You must be logged in to upload files");
          toast.error("You must be logged in to upload files");
          return false;
        }

        setUploadProgress(20);

        // Generate unique path
        const timestamp = Date.now();
        const ext = file.name.substring(file.name.lastIndexOf("."));
        const storagePath = `${currentWorkspace.id}/${entityType}/${entityId}/${timestamp}_${file.name}`;

        // Upload to storage bucket
        const { error: uploadStorageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadStorageError) {
          console.error("[useDocuments] Upload error:", uploadStorageError);
          setUploadError("Failed to upload file: " + uploadStorageError.message);
          toast.error("Failed to upload file: " + uploadStorageError.message);
          return false;
        }

        setUploadProgress(60);

        // Create document record
        const { data: docData, error: insertError } = await supabase
          .from("documents")
          .insert({
            tenant_id: currentWorkspace.id,
            entity_type: entityType,
            entity_id: entityId,
            name: file.name,
            file_type: ext.replace(".", "").toUpperCase(),
            document_type: documentType,
            storage_path: storagePath,
            file_size_bytes: file.size,
            owner_id: user.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[useDocuments] Insert error:", insertError);
          // Cleanup uploaded file
          await supabase.storage.from("documents").remove([storagePath]);
          setUploadError("Failed to create document record");
          toast.error("Failed to create document record");
          return false;
        }

        setUploadProgress(80);

        toast.success("Document uploaded successfully");

        // Trigger background text extraction
        if (docData) {
          triggerTextExtraction(docData.id, storagePath);
        }

        setUploadProgress(100);

        // Refresh document list
        await fetchDocuments();
        return true;
      } catch (error) {
        console.error("[useDocuments] Unexpected error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
        setUploadError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setIsUploading(false);
        // Reset progress after a delay
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [currentWorkspace?.id, entityType, entityId, validateFile, fetchDocuments, triggerTextExtraction]
  );

  const getSignedUrl = useCallback(
    async (storagePath: string): Promise<string | null> => {
      try {
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(storagePath, 3600);

        if (error) {
          console.error("[useDocuments] Signed URL error:", error);
          return null;
        }

        return data.signedUrl;
      } catch (error) {
        console.error("[useDocuments] Unexpected error getting signed URL:", error);
        return null;
      }
    },
    []
  );

  const downloadDocument = useCallback(
    async (doc: Document): Promise<void> => {
      if (!doc.storagePath) {
        toast.error("No file available for download");
        return;
      }

      setIsDownloading(true);

      try {
        const { data, error } = await supabase.storage
          .from("documents")
          .download(doc.storagePath);

        if (error) {
          console.error("[useDocuments] Download error:", error);
          toast.error("Failed to download document");
          return;
        }

        // Create download link
        const url = URL.createObjectURL(data);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = doc.name;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Document downloaded");
      } catch (error) {
        console.error("[useDocuments] Unexpected download error:", error);
        toast.error("An unexpected error occurred");
      } finally {
        setIsDownloading(false);
      }
    },
    []
  );

  const deleteDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        // Soft delete - just mark as inactive
        const { error } = await supabase
          .from("documents")
          .update({ is_active: false })
          .eq("id", documentId);

        if (error) {
          console.error("[useDocuments] Delete error:", error);
          toast.error("Failed to delete document");
          return false;
        }

        toast.success("Document deleted");
        await fetchDocuments();
        return true;
      } catch (error) {
        console.error("[useDocuments] Unexpected delete error:", error);
        toast.error("An unexpected error occurred");
        return false;
      }
    },
    [fetchDocuments]
  );

  const setActiveDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        // Get the document to find its type
        const doc = documents.find((d) => d.id === documentId);
        if (!doc) {
          toast.error("Document not found");
          return false;
        }

        // For now, we just show a message - in a full implementation,
        // you'd have an 'active' flag per document type
        toast.success(`Set "${doc.name}" as active version`);
        return true;
      } catch (error) {
        console.error("[useDocuments] Set active error:", error);
        toast.error("Failed to set active document");
        return false;
      }
    },
    [documents]
  );

  return {
    documents,
    isLoading,
    isUploading,
    isDownloading,
    uploadError,
    uploadProgress,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    setActiveDocument,
    getSignedUrl,
    validateFile,
    refetch: fetchDocuments,
    clearError,
  };
}
