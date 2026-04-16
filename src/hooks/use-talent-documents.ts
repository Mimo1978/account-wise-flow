import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import {
  TalentDocument,
  TalentDocumentRow,
  DocKind,
  mapTalentDocumentRow,
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
} from '@/lib/talent-document-types';

interface UseTalentDocumentsOptions {
  talentId: string;
}

interface UseTalentDocumentsReturn {
  documents: TalentDocument[];
  isLoading: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  uploadError: string | null;
  uploadDocument: (file: File, docKind: DocKind) => Promise<boolean>;
  downloadDocument: (document: TalentDocument) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<boolean>;
  retryExtraction: (documentId: string) => Promise<boolean>;
  getSignedUrl: (filePath: string) => Promise<string | null>;
  validateFile: (file: File) => { valid: boolean; error?: string };
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useTalentDocuments({ talentId }: UseTalentDocumentsOptions): UseTalentDocumentsReturn {
  const { currentWorkspace } = useWorkspace();
  const [documents, setDocuments] = useState<TalentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!currentWorkspace?.id || !talentId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('talent_documents')
        .select('*')
        .eq('talent_id', talentId)
        .eq('workspace_id', currentWorkspace.id)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('[useTalentDocuments] Fetch error:', error);
        setDocuments([]);
      } else {
        setDocuments((data as TalentDocumentRow[]).map(mapTalentDocumentRow));
      }
    } catch (error) {
      console.error('[useTalentDocuments] Unexpected error:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, talentId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    const isValidType = ACCEPTED_FILE_TYPES.includes(file.type);
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidExt = ACCEPTED_FILE_EXTENSIONS.includes(ext);

    if (!isValidType && !isValidExt) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload a PDF, DOC, or DOCX file.',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'File is too large. Maximum size is 10MB.',
      };
    }

    return { valid: true };
  }, []);

  // Trigger text extraction for a document (async, non-blocking)
  const triggerTextExtraction = useCallback(
    async (documentId: string): Promise<void> => {
      try {
        console.log('[useTalentDocuments] Triggering text extraction for:', documentId);

        const { data, error } = await supabase.functions.invoke('cv-text-extract', {
          body: { talentDocumentId: documentId },
        });

        if (error) {
          console.error('[useTalentDocuments] Text extraction trigger failed:', error);
          // Update status to failed
          await supabase
            .from('talent_documents')
            .update({ parse_status: 'failed' as const, updated_at: new Date().toISOString() })
            .eq('id', documentId);
          return;
        }

        console.log('[useTalentDocuments] Text extraction complete:', data);
        // Refresh document list to show updated status
        await fetchDocuments();
      } catch (error) {
        console.error('[useTalentDocuments] Text extraction error:', error);
        // Mark as failed on error
        await supabase
          .from('talent_documents')
          .update({ parse_status: 'failed' as const, updated_at: new Date().toISOString() })
          .eq('id', documentId);
      }
    },
    [fetchDocuments]
  );

  // Retry text extraction for a failed document
  const retryExtraction = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        // Reset status to pending
        await supabase
          .from('talent_documents')
          .update({ parse_status: 'pending' as const, updated_at: new Date().toISOString() })
          .eq('id', documentId);

        // Refresh UI immediately to show pending state
        await fetchDocuments();

        // Trigger extraction
        toast.loading('Retrying text extraction...', { id: `retry-${documentId}` });
        
        const { error } = await supabase.functions.invoke('cv-text-extract', {
          body: { talentDocumentId: documentId },
        });

        if (error) {
          console.error('[useTalentDocuments] Retry extraction failed:', error);
          toast.error('Text extraction failed', { id: `retry-${documentId}` });
          await supabase
            .from('talent_documents')
            .update({ parse_status: 'failed' as const, updated_at: new Date().toISOString() })
            .eq('id', documentId);
          await fetchDocuments();
          return false;
        }

        toast.success('Text extraction complete', { id: `retry-${documentId}` });
        await fetchDocuments();
        return true;
      } catch (error) {
        console.error('[useTalentDocuments] Retry extraction error:', error);
        toast.error('Text extraction failed');
        return false;
      }
    },
    [fetchDocuments]
  );

  const uploadDocument = useCallback(
    async (file: File, docKind: DocKind): Promise<boolean> => {
      if (!currentWorkspace?.id) {
        setUploadError('No workspace selected');
        toast.error('No workspace selected');
        return false;
      }

      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid file');
        toast.error(validation.error);
        return false;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUploadError('You must be logged in to upload files');
          toast.error('You must be logged in to upload files');
          return false;
        }

        // Generate unique path: workspace/talent/timestamp_filename
        const timestamp = Date.now();
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${currentWorkspace.id}/${talentId}/${timestamp}_${sanitizedFileName}`;

        // Upload to private storage bucket
        const { error: uploadStorageError } = await supabase.storage
          .from('candidate_cvs')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadStorageError) {
          console.error('[useTalentDocuments] Upload error:', uploadStorageError);
          setUploadError('Failed to upload file: ' + uploadStorageError.message);
          toast.error('Failed to upload file: ' + uploadStorageError.message);
          return false;
        }

        // Create document record
        const { data: insertedDoc, error: insertError } = await supabase
          .from('talent_documents')
          .insert({
            workspace_id: currentWorkspace.id,
            talent_id: talentId,
            file_path: storagePath,
            file_name: file.name,
            file_type: ext.replace('.', '').toUpperCase(),
            file_size: file.size,
            uploaded_by: user.id,
            doc_kind: docKind,
            parse_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError || !insertedDoc) {
          console.error('[useTalentDocuments] Insert error:', insertError);
          // Cleanup uploaded file
          await supabase.storage.from('candidate_cvs').remove([storagePath]);
          setUploadError('Failed to create document record');
          toast.error('Failed to create document record');
          return false;
        }

        toast.success('Document uploaded successfully');
        
        // Refresh document list first
        await fetchDocuments();

        // Trigger text extraction asynchronously (don't await - let it run in background)
        triggerTextExtraction(insertedDoc.id);

        // Trigger PDF conversion in background (fire and forget)
        supabase.functions.invoke('convert-cv-to-pdf', {
          body: { document_id: insertedDoc.id }
        }).catch((err) => console.error('[useTalentDocuments] PDF conversion trigger error:', err));

        return true;
      } catch (error) {
        console.error('[useTalentDocuments] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setUploadError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [currentWorkspace?.id, talentId, validateFile, fetchDocuments, triggerTextExtraction]
  );

  const getSignedUrl = useCallback(
    async (filePath: string): Promise<string | null> => {
      // Try candidate_cvs bucket first, then cv-uploads as fallback (batch imports)
      const buckets = ['candidate_cvs', 'cv-uploads'];
      for (const bucket of buckets) {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600);

          if (!error && data?.signedUrl) {
            return data.signedUrl;
          }
        } catch {
          // Try next bucket
        }
      }
      console.error('[useTalentDocuments] Could not get signed URL from any bucket for:', filePath);
      return null;
    },
    []
  );

  const downloadDocument = useCallback(
    async (doc: TalentDocument): Promise<void> => {
      if (!doc.filePath) {
        toast.error('No file available for download');
        return;
      }

      setIsDownloading(true);

      try {
        // Try candidate_cvs bucket first, then cv-uploads as fallback (batch imports)
        let downloadedData: Blob | null = null;
        for (const bucket of ['candidate_cvs', 'cv-uploads']) {
          const result = await supabase.storage.from(bucket).download(doc.filePath);
          if (!result.error && result.data) {
            downloadedData = result.data;
            break;
          }
        }

        if (!downloadedData) {
          console.error('[useTalentDocuments] Download failed from all buckets');
          toast.error('Failed to download document');
          return;
        }

        // Create download link
        const url = URL.createObjectURL(downloadedData);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Document downloaded');
      } catch (error) {
        console.error('[useTalentDocuments] Unexpected download error:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setIsDownloading(false);
      }
    },
    []
  );

  const deleteDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      try {
        // Get the document to find its file path
        const doc = documents.find((d) => d.id === documentId);
        if (!doc) {
          toast.error('Document not found');
          return false;
        }

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('candidate_cvs')
          .remove([doc.filePath]);

        if (storageError) {
          console.error('[useTalentDocuments] Storage delete error:', storageError);
          // Continue anyway - the record delete is more important
        }

        // Delete the record
        const { error } = await supabase
          .from('talent_documents')
          .delete()
          .eq('id', documentId);

        if (error) {
          console.error('[useTalentDocuments] Delete error:', error);
          toast.error('Failed to delete document');
          return false;
        }

        toast.success('Document deleted');
        await fetchDocuments();
        return true;
      } catch (error) {
        console.error('[useTalentDocuments] Unexpected delete error:', error);
        toast.error('An unexpected error occurred');
        return false;
      }
    },
    [documents, fetchDocuments]
  );

  return {
    documents,
    isLoading,
    isUploading,
    isDownloading,
    uploadError,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    retryExtraction,
    getSignedUrl,
    validateFile,
    refetch: fetchDocuments,
    clearError,
  };
}
