import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ImportSource = 'CANVAS' | 'TALENT' | 'CONTACT' | 'COMPANY';
export type FileType = 'CV_RESUME' | 'BUSINESS_CARD' | 'ORG_CHART' | 'NOTES_DOCUMENT' | 'UNKNOWN';
export type StoreDestination = 'candidate' | 'contact' | 'both' | 'attach_only';

export interface SmartImportContext {
  source: ImportSource;
  workspaceId?: string;
  companyId?: string;
  contactId?: string;
  candidateId?: string;
  companyName?: string;
}

export interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'document';
  detectedType?: FileType;
  detectedConfidence?: number;
  userOverrideType?: FileType;
}

export interface ImportProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  status: string;
}

export interface SmartImportState {
  files: FilePreview[];
  isProcessing: boolean;
  batchId: string | null;
  progress: ImportProgress | null;
  step: 'upload' | 'processing' | 'complete';
  debugLogs: string[];
}

/**
 * Get default store destination based on import source and detected file type
 */
export function getDefaultDestination(
  source: ImportSource,
  fileType: FileType | undefined,
  hasCompanyContext: boolean
): StoreDestination {
  if (source === 'TALENT') {
    if (fileType === 'CV_RESUME') return 'candidate';
    if (fileType === 'NOTES_DOCUMENT') return 'attach_only';
    if (fileType === 'BUSINESS_CARD') return 'contact';
    return 'candidate';
  }

  if (source === 'CONTACT') {
    if (fileType === 'CV_RESUME') return 'candidate';
    if (fileType === 'NOTES_DOCUMENT') return 'attach_only';
    if (fileType === 'BUSINESS_CARD') return 'contact';
    return 'contact';
  }

  if (source === 'CANVAS' || source === 'COMPANY') {
    if (fileType === 'CV_RESUME') return hasCompanyContext ? 'both' : 'candidate';
    if (fileType === 'BUSINESS_CARD') return 'contact';
    if (fileType === 'ORG_CHART') return 'contact';
    if (fileType === 'NOTES_DOCUMENT') return 'attach_only';
    return 'contact';
  }

  return 'candidate';
}

/**
 * Get suggested company ID based on context
 */
export function getSuggestedCompanyId(context: SmartImportContext): string | null {
  if (context.companyId) return context.companyId;
  return null;
}

export function useSmartImport(context: SmartImportContext) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [step, setStep] = useState<'upload' | 'processing' | 'complete'>('upload');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SmartImport] ${message}`);
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const getFileType = useCallback((file: File): 'image' | 'pdf' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    return 'document';
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FilePreview[] = [];
    
    Array.from(fileList).forEach((file) => {
      const type = getFileType(file);
      let preview = '';
      
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }
      
      newFiles.push({ file, preview, type });
    });
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [getFileType]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const clearFiles = useCallback(() => {
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }, [files]);

  const setFileTypeOverride = useCallback((index: number, type: FileType) => {
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, userOverrideType: type } : f
    ));
  }, []);

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const startPolling = useCallback((currentBatchId: string, requestId: string, onComplete: () => void) => {
    addDebugLog(`[${requestId}] Starting progress polling for batch ${currentBatchId}`);
    
    const pollProgress = async () => {
      try {
        const { data: batch, error: batchError } = await supabase
          .from('cv_import_batches')
          .select('*')
          .eq('id', currentBatchId)
          .single();
        
        if (batchError || !batch) {
          addDebugLog(`[${requestId}] Batch fetch error: ${batchError?.message}`);
          return;
        }
        
        setProgress({
          total: batch.total_files,
          processed: batch.processed_files,
          succeeded: batch.success_count,
          failed: batch.fail_count,
          status: batch.status
        });
        
        addDebugLog(`[${requestId}] Progress: ${batch.processed_files}/${batch.total_files} (${batch.status})`);
        
        // Check for import_entities
        const { data: entities } = await supabase
          .from('import_entities')
          .select('id, entity_type, status')
          .eq('batch_id', currentBatchId);
        
        const entityCount = entities?.length || 0;
        
        if (entityCount > 0) {
          addDebugLog(`[${requestId}] Found ${entityCount} entities in staging`);
        }
        
        const isComplete = batch.status === 'completed' || batch.status === 'partial' || batch.status === 'failed';
        const hasEntities = entityCount > 0;
        
        if (isComplete || (hasEntities && batch.processed_files > 0)) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          addDebugLog(`[${requestId}] Batch ready: status=${batch.status}, entities=${entityCount}`);
          setIsProcessing(false);
          setStep('complete');
          
          if (entityCount > 0) {
            toast.success(`Import ready — ${entityCount} entities detected. Opening review...`);
          } else {
            toast.info(`Processing complete. Open review to add data manually.`);
          }
          
          onComplete();
          navigate(`/imports/${currentBatchId}/review?source=${context.source}${context.companyId ? `&companyId=${context.companyId}` : ''}`);
        }
      } catch (err) {
        addDebugLog(`[${requestId}] Poll error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    };
    
    pollProgress();
    pollIntervalRef.current = setInterval(pollProgress, 2000);
  }, [addDebugLog, context.source, context.companyId, navigate]);

  const processFiles = useCallback(async (onComplete: () => void) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setDebugLogs([]);
    setStep('processing');
    
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    addDebugLog(`[${requestId}] Starting async processing of ${files.length} files`);
    addDebugLog(`[${requestId}] Context: source=${context.source}, companyId=${context.companyId || 'none'}`);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        addDebugLog(`[${requestId}] Session error: ${sessionError.message}`);
      }
      
      if (session?.access_token) {
        addDebugLog(`[${requestId}] Auth: Using authenticated session`);
      } else {
        addDebugLog(`[${requestId}] Auth: No active session, proceeding in demo mode`);
      }

      const filePayloads = await Promise.all(files.map(async (f, idx) => {
        const base64 = await fileToBase64(f.file);
        addDebugLog(`[${requestId}] File ${idx + 1}: ${f.file.name} (${f.file.type})`);
        return {
          base64,
          mimeType: f.file.type,
          fileName: f.file.name,
          userOverrideType: f.userOverrideType,
          importContext: {
            source: context.source,
            companyId: context.companyId,
            contactId: context.contactId,
            candidateId: context.candidateId,
          }
        };
      }));

      addDebugLog(`[${requestId}] Calling ai-unified-import...`);
      
      const headers: Record<string, string> = { 'x-request-id': requestId };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const { data, error } = await supabase.functions.invoke('ai-unified-import', {
        body: { 
          files: filePayloads,
          importContext: {
            source: context.source,
            companyId: context.companyId,
            companyName: context.companyName,
          }
        },
        headers
      });

      if (error) {
        addDebugLog(`[${requestId}] NETWORK ERROR: ${error.message}`);
        toast.error(`Import failed: ${error.message}`);
        setIsProcessing(false);
        setStep('upload');
        return;
      }

      if (!data?.ok) {
        addDebugLog(`[${requestId}] API ERROR: ${data?.error_code || 'UNKNOWN'}`);
        toast.error(data?.message || 'Enqueue failed');
        setIsProcessing(false);
        setStep('upload');
        return;
      }

      const newBatchId = data.batch_id;
      addDebugLog(`[${requestId}] Batch created: ${newBatchId}`);
      setBatchId(newBatchId);
      setProgress({
        total: data.queued || 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        status: 'processing'
      });
      
      toast.info(`${data.queued || 0} files queued for processing`);
      startPolling(newBatchId, requestId, onComplete);

    } catch (err) {
      console.error('Processing error:', err);
      addDebugLog(`[${requestId}] EXCEPTION: ${err instanceof Error ? err.message : 'Unknown'}`);
      toast.error('Failed to enqueue files');
      setIsProcessing(false);
      setStep('upload');
    }
  }, [files, context, addDebugLog, fileToBase64, startPolling]);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    clearFiles();
    setIsProcessing(false);
    setBatchId(null);
    setProgress(null);
    setStep('upload');
    setDebugLogs([]);
  }, [clearFiles]);

  const navigateToReview = useCallback(() => {
    if (batchId) {
      navigate(`/imports/${batchId}/review?source=${context.source}${context.companyId ? `&companyId=${context.companyId}` : ''}`);
    }
  }, [batchId, context.source, context.companyId, navigate]);

  return {
    // State
    files,
    isProcessing,
    batchId,
    progress,
    step,
    debugLogs,
    context,
    
    // Actions
    addFiles,
    removeFile,
    clearFiles,
    setFileTypeOverride,
    processFiles,
    reset,
    navigateToReview,
    
    // Helpers
    getDefaultDestination: (fileType: FileType | undefined) => 
      getDefaultDestination(context.source, fileType, !!context.companyId),
    getSuggestedCompanyId: () => getSuggestedCompanyId(context),
  };
}
