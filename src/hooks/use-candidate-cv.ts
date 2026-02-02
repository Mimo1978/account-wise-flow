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
        const ext = file.name.substring(file.name.lastIndexOf("."));
        const storagePath = `${currentWorkspace.id}/${candidateId}/${timestamp}_cv${ext}`;

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

        toast.success("CV uploaded successfully");
        return true;
      } catch (error) {
        console.error("[useCandidateCV] Unexpected error:", error);
        toast.error("An unexpected error occurred");
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [currentWorkspace?.id, validateFile]
  );

  const getSignedUrl = useCallback(
    async (storagePath: string): Promise<string | null> => {
      try {
        const { data, error } = await supabase.storage
          .from("cv-uploads")
          .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (error) {
          console.error("[useCandidateCV] Signed URL error:", error);
          return null;
        }

        return data.signedUrl;
      } catch (error) {
        console.error("[useCandidateCV] Unexpected error getting signed URL:", error);
        return null;
      }
    },
    []
  );

  const downloadCV = useCallback(
    async (candidateId: string, storagePath: string, filename: string): Promise<void> => {
      if (!storagePath) {
        toast.error("No CV available for download");
        return;
      }

      setIsDownloading(true);

      try {
        const { data, error } = await supabase.storage
          .from("cv-uploads")
          .download(storagePath);

        if (error) {
          console.error("[useCandidateCV] Download error:", error);
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
    []
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
