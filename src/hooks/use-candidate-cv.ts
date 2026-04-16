import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];

export interface CVMetadata {
  filename: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  storagePath: string;
  fileSize: number;
}

interface UseCandidateCVReturn {
  isUploading: boolean;
  isDownloading: boolean;
  uploadCV: (candidateId: string, file: File) => Promise<boolean>;
  downloadCV: (candidateId: string, storagePath: string, filename: string) => Promise<void>;
  getSignedUrl: (storagePath: string) => Promise<string | null>;
  validateFile: (file: File) => { valid: boolean; error?: string };
}

export function useCandidateCV(): UseCandidateCVReturn {
  const { currentWorkspace } = useWorkspace();
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const resolveStorageBucket = useCallback((storagePath?: string | null) => {
    if (!storagePath) return ["cv-uploads", "candidate_cvs"] as const;
    const normalized = storagePath.toLowerCase();
    if (normalized.startsWith("candidate_cvs/")) return ["candidate_cvs", "cv-uploads"] as const;
    if (normalized.startsWith("cv-uploads/")) return ["cv-uploads", "candidate_cvs"] as const;
    return ["cv-uploads", "candidate_cvs"] as const;
  }, []);

  const normalizeStoragePath = useCallback((storagePath?: string | null) => {
    if (!storagePath) return null;
    return storagePath.replace(/^candidate_cvs\//i, "").replace(/^cv-uploads\//i, "");
  }, []);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    const isValidType = ACCEPTED_TYPES.includes(file.type);
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    const isValidExt = ACCEPTED_EXTENSIONS.includes(ext);

    if (!isValidType && !isValidExt) {
      return {
        valid: false,
        error: "Invalid file type. Please upload a PDF, DOC, or DOCX file.",
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "File is too large. Maximum size is 10MB.",
      };
    }

    return { valid: true };
  }, []);

  const triggerTextExtraction = useCallback(
    async (candidateId: string, storagePath: string): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.warn("[useCandidateCV] No session for text extraction");
          return;
        }

        console.log("[useCandidateCV] Triggering text extraction for:", storagePath);

        const { data, error } = await supabase.functions.invoke('cv-text-extract', {
          body: {
            candidateId,
            storagePath,
          },
        });

        if (error) {
          console.error("[useCandidateCV] Text extraction failed:", error);
          // Don't fail the upload - extraction is a background enhancement
          return;
        }

        console.log("[useCandidateCV] Text extraction complete:", data);
      } catch (error) {
        console.error("[useCandidateCV] Text extraction error:", error);
        // Silent failure - don't block the upload
      }
    },
    []
  );

  const uploadCV = useCallback(
    async (candidateId: string, file: File): Promise<boolean> => {
      if (!currentWorkspace?.id) {
        toast.error("No workspace selected");
        return false;
      }

      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        return false;
      }

      setIsUploading(true);

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("You must be logged in to upload files");
          return false;
        }

        // Generate unique path with timestamp
        const timestamp = Date.now();
        const fileExtension = file.name.substring(file.name.lastIndexOf("."));
        const storagePath = `${currentWorkspace.id}/${candidateId}/${timestamp}_cv${fileExtension}`;

        // Upload to storage bucket
        const { error: uploadError } = await supabase.storage
          .from("cv-uploads")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("[useCandidateCV] Upload error:", uploadError);
          toast.error("Failed to upload file: " + uploadError.message);
          return false;
        }

        // Update candidate record with CV path
        const { error: updateError } = await supabase
          .from("candidates")
          .update({
            cv_storage_path: storagePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", candidateId);

        if (updateError) {
          console.error("[useCandidateCV] Update error:", updateError);
          // Attempt to clean up uploaded file
          await supabase.storage.from("cv-uploads").remove([storagePath]);
          toast.error("Failed to update candidate record");
          return false;
        }

        const normalizedExtension = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const { data: existingDoc } = await supabase
          .from("talent_documents")
          .select("id")
          .eq("talent_id", candidateId)
          .eq("workspace_id", currentWorkspace.id)
          .eq("doc_kind", "cv")
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const talentDocumentPayload = {
          workspace_id: currentWorkspace.id,
          talent_id: candidateId,
          file_path: storagePath,
          file_name: file.name,
          file_type: normalizedExtension,
          file_size: file.size,
          uploaded_by: user.id,
          doc_kind: "cv" as const,
          parse_status: "pending" as const,
          pdf_storage_path: null,
          pdf_conversion_status: file.type === "application/pdf" || normalizedExtension === "pdf" ? "not_needed" : "pending",
          updated_at: new Date().toISOString(),
        };

        const { data: talentDocument, error: docError } = existingDoc?.id
          ? await supabase
              .from("talent_documents")
              .update(talentDocumentPayload)
              .eq("id", existingDoc.id)
              .select("id")
              .single()
          : await supabase
              .from("talent_documents")
              .insert(talentDocumentPayload)
              .select("id")
              .single();

        if (docError) {
          console.error("[useCandidateCV] talent_documents sync error:", docError);
        }

        toast.success("CV uploaded successfully");

        // Trigger background text extraction for AI features
        // This runs asynchronously and doesn't block the upload
        triggerTextExtraction(candidateId, storagePath);

        if (talentDocument?.id) {
          supabase.functions.invoke("convert-cv-to-pdf", {
            body: { document_id: talentDocument.id },
          }).catch((error) => {
            console.error("[useCandidateCV] PDF conversion trigger failed:", error);
          });
        }

        return true;
      } catch (error) {
        console.error("[useCandidateCV] Unexpected error:", error);
        toast.error("An unexpected error occurred");
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [currentWorkspace?.id, validateFile, triggerTextExtraction]
  );

  const getSignedUrl = useCallback(
    async (storagePath: string): Promise<string | null> => {
      try {
        const normalizedPath = normalizeStoragePath(storagePath);
        if (!normalizedPath) return null;

        for (const bucket of resolveStorageBucket(storagePath)) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(normalizedPath, 3600);

          if (!error && data?.signedUrl) {
            return data.signedUrl;
          }
        }

        return null;
      } catch (error) {
        console.error("[useCandidateCV] Unexpected error getting signed URL:", error);
        return null;
      }
    },
    [normalizeStoragePath, resolveStorageBucket]
  );

  const downloadCV = useCallback(
    async (candidateId: string, storagePath: string, filename: string): Promise<void> => {
      if (!storagePath) {
        toast.error("No CV available for download");
        return;
      }

      setIsDownloading(true);

      try {
        const normalizedPath = normalizeStoragePath(storagePath);
        if (!normalizedPath) {
          toast.error("Failed to download CV");
          return;
        }

        let data: Blob | null = null;
        for (const bucket of resolveStorageBucket(storagePath)) {
          const result = await supabase.storage.from(bucket).download(normalizedPath);
          if (!result.error && result.data) {
            data = result.data;
            break;
          }
        }

        if (!data) {
          toast.error("Failed to download CV");
          return;
        }

        // Create download link
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `CV_${candidateId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("CV downloaded");
      } catch (error) {
        console.error("[useCandidateCV] Unexpected download error:", error);
        toast.error("An unexpected error occurred");
      } finally {
        setIsDownloading(false);
      }
    },
    [normalizeStoragePath, resolveStorageBucket]
  );

  return {
    isUploading,
    isDownloading,
    uploadCV,
    downloadCV,
    getSignedUrl,
    validateFile,
  };
}
