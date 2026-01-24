import { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlexibleCombobox } from "./FlexibleCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Image, 
  FileText, 
  Camera, 
  X, 
  Sparkles,
  FileImage,
  Building2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  MapPin,
  Briefcase,
  HelpCircle,
  FileUser,
  Network,
  StickyNote,
  CreditCard,
  ChevronDown,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Contact, Account, Talent } from "@/lib/types";
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import {
  departmentOptions,
  jobTitleOptionsFlat,
  seniorityOptions,
} from "@/lib/dropdown-options";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AIImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (contacts: Contact[]) => void;
  onTalentImportComplete?: (talent: Talent) => void;
  existingContacts?: Contact[];
  currentCompany?: string;
}

type FileType = 'CV_RESUME' | 'BUSINESS_CARD' | 'ORG_CHART' | 'NOTES_DOCUMENT' | 'UNKNOWN';

type FilePreview = {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'document';
  detectedType?: FileType;
  detectedConfidence?: number;
  detectedReasoning?: string;
  userOverrideType?: FileType;
  isProcessed?: boolean;
  processingError?: string;
};

type EntityType = 'candidate' | 'contact' | 'org_node' | 'notes';

type ExtractedEntity = {
  id: string;
  sourceFileIndex: number;
  type: EntityType;
  data: any;
  confidence: number;
  missingFields: string[];
  selected: boolean;
  destination: 'talent' | 'contact' | 'org_chart' | 'notes' | 'skip';
  duplicateOf?: string;
};

type ImportAction = 'new' | 'merge' | 'database-only' | 'database-and-chart' | 'notes-only';

type CompanyAssignment = 'existing' | 'new' | 'unassigned';

type NewCompanyData = {
  name: string;
  industry: string;
  location: string;
};

const fileTypeLabels: Record<FileType, { label: string; icon: React.ReactNode; color: string }> = {
  CV_RESUME: { label: 'CV / Resume', icon: <FileUser className="h-4 w-4" />, color: 'text-blue-500' },
  BUSINESS_CARD: { label: 'Business Card', icon: <CreditCard className="h-4 w-4" />, color: 'text-green-500' },
  ORG_CHART: { label: 'Org Chart', icon: <Network className="h-4 w-4" />, color: 'text-purple-500' },
  NOTES_DOCUMENT: { label: 'Meeting Notes', icon: <StickyNote className="h-4 w-4" />, color: 'text-amber-500' },
  UNKNOWN: { label: 'Unknown', icon: <HelpCircle className="h-4 w-4" />, color: 'text-muted-foreground' },
};

const confidenceColors: Record<string, string> = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-red-500/20 text-red-400',
};

export const AIImportModal = ({
  open,
  onOpenChange,
  onImportComplete,
  onTalentImportComplete,
  existingContacts = mockAccount.contacts,
  currentCompany,
}: AIImportModalProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'routing' | 'company'>('upload');
  const [selectedAction, setSelectedAction] = useState<ImportAction>('database-and-chart');
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  
  // Batch processing state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
    status: string;
  } | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Company assignment state
  const [companyAssignment, setCompanyAssignment] = useState<CompanyAssignment>('existing');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(currentCompany || mockAccount.id);
  const [companySearch, setCompanySearch] = useState('');
  const [newCompanyData, setNewCompanyData] = useState<NewCompanyData>({
    name: '',
    industry: '',
    location: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[AIImport] ${message}`);
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Filter companies based on search
  const filteredCompanies = useMemo(() => {
    if (!companySearch) return mockAccounts;
    const search = companySearch.toLowerCase();
    return mockAccounts.filter(acc => 
      acc.name.toLowerCase().includes(search) ||
      acc.industry?.toLowerCase().includes(search)
    );
  }, [companySearch]);

  const selectedCompany = useMemo(() => 
    mockAccounts.find(acc => acc.id === selectedCompanyId),
    [selectedCompanyId]
  );

  const handleClose = () => {
    // Clear any polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    setFiles([]);
    setIsDragging(false);
    setIsProcessing(false);
    setExtractedEntities([]);
    setStep('upload');
    setSelectedAction('database-and-chart');
    setCompanyAssignment('existing');
    setSelectedCompanyId(currentCompany || mockAccount.id);
    setCompanySearch('');
    setNewCompanyData({ name: '', industry: '', location: '' });
    setDebugLogs([]);
    setBatchId(null);
    setBatchProgress(null);
    onOpenChange(false);
  };

  const getFileType = (file: File): 'image' | 'pdf' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    return 'document';
  };

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FilePreview[] = [];
    
    Array.from(fileList).forEach((file) => {
      const type = getFileType(file);
      let preview = '';
      
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }
      
      newFiles.push({ file, preview, type });
    });
    
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const setFileTypeOverride = (index: number, type: FileType) => {
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, userOverrideType: type } : f
    ));
  };

  const fileToBase64 = (file: File): Promise<string> => {
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
  };

  const findDuplicate = (name: string, email?: string): Contact | undefined => {
    const normalizedName = name.toLowerCase().trim();
    return existingContacts.find(c => {
      if (email && c.email && c.email.toLowerCase() === email.toLowerCase()) {
        return true;
      }
      return c.name.toLowerCase().trim() === normalizedName ||
        c.name.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(c.name.toLowerCase());
    });
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setDebugLogs([]);
    setStep('processing');
    
    // Generate client-side request ID for correlation
    const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    addDebugLog(`[${requestId}] Starting async processing of ${files.length} files`);

    try {
      // Get the current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        addDebugLog(`[${requestId}] Session error: ${sessionError.message}`);
      }
      
      // Log auth state for debugging
      if (session?.access_token) {
        addDebugLog(`[${requestId}] Auth: Using authenticated session (user: ${session.user?.email || session.user?.id})`);
      } else {
        addDebugLog(`[${requestId}] Auth: No active session, proceeding in demo mode`);
      }

      // Prepare files for API
      const filePayloads = await Promise.all(files.map(async (f, idx) => {
        const base64 = await fileToBase64(f.file);
        addDebugLog(`[${requestId}] File ${idx + 1}: ${f.file.name} (${f.file.type}, ${(f.file.size / 1024).toFixed(1)}KB)`);
        return {
          base64,
          mimeType: f.file.type,
          fileName: f.file.name,
          userOverrideType: f.userOverrideType,
        };
      }));

      addDebugLog(`[${requestId}] Calling ai-unified-import to enqueue files...`);
      
      // Build headers with auth token if available
      const headers: Record<string, string> = { 
        'x-request-id': requestId,
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const { data, error } = await supabase.functions.invoke('ai-unified-import', {
        body: { files: filePayloads },
        headers
      });

      // Handle network/invocation errors
      if (error) {
        const errorMsg = error.message || 'Unknown network error';
        addDebugLog(`[${requestId}] NETWORK ERROR: ${errorMsg}`);
        
        if (errorMsg.includes('JWT') || errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
          toast.error('Session expired. Please sign in again.');
        } else {
          toast.error(`Enqueue failed: ${errorMsg}`, {
            action: { label: 'Show Logs', onClick: () => setDebugOpen(true) }
          });
        }
        setIsProcessing(false);
        setStep('upload');
        return;
      }

      // Handle structured API errors
      if (!data?.ok) {
        const errorCode = data?.error_code || 'UNKNOWN_ERROR';
        const errorMsg = data?.message || 'Enqueue failed';
        addDebugLog(`[${requestId}] API ERROR: ${errorCode} - ${errorMsg}`);
        
        toast.error(errorMsg, {
          description: data?.details,
          action: { label: 'Show Logs', onClick: () => setDebugOpen(true) }
        });
        setIsProcessing(false);
        setStep('upload');
        return;
      }

      // Successfully enqueued
      const newBatchId = data.batch_id;
      const queuedCount = data.queued || 0;
      
      addDebugLog(`[${requestId}] Batch created: ${newBatchId}, ${queuedCount} files queued`);
      setBatchId(newBatchId);
      setBatchProgress({
        total: queuedCount,
        processed: 0,
        succeeded: 0,
        failed: 0,
        status: 'processing'
      });
      
      toast.info(`${queuedCount} files queued for processing`);
      
      // Start polling for progress
      startPolling(newBatchId, requestId);

    } catch (err) {
      console.error('Processing error:', err);
      addDebugLog(`[${requestId}] EXCEPTION: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error('Failed to enqueue files', {
        description: err instanceof Error ? err.message : 'Unknown error',
        action: { label: 'Show Logs', onClick: () => setDebugOpen(true) }
      });
      setIsProcessing(false);
      setStep('upload');
    }
  };

  const startPolling = (currentBatchId: string, requestId: string) => {
    addDebugLog(`[${requestId}] Starting progress polling for batch ${currentBatchId}`);
    
    const pollProgress = async () => {
      try {
        // Query batch progress
        const { data: batch, error: batchError } = await supabase
          .from('cv_import_batches')
          .select('*')
          .eq('id', currentBatchId)
          .single();
        
        if (batchError || !batch) {
          addDebugLog(`[${requestId}] Batch fetch error: ${batchError?.message}`);
          return;
        }
        
        setBatchProgress({
          total: batch.total_files,
          processed: batch.processed_files,
          succeeded: batch.success_count,
          failed: batch.fail_count,
          status: batch.status
        });
        
        addDebugLog(`[${requestId}] Progress: ${batch.processed_files}/${batch.total_files} (${batch.status})`);
        
        // Check if complete
        if (batch.status === 'completed' || batch.status === 'partial' || batch.status === 'failed') {
          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          addDebugLog(`[${requestId}] Batch complete with status: ${batch.status}`);
          
          // Fetch parsed items
          const { data: items, error: itemsError } = await supabase
            .from('cv_import_items')
            .select('*')
            .eq('batch_id', currentBatchId);
          
          if (itemsError) {
            addDebugLog(`[${requestId}] Items fetch error: ${itemsError.message}`);
          }
          
          // Convert items to extracted entities
          processCompletedItems(items || [], requestId);
        }
        
      } catch (err) {
        addDebugLog(`[${requestId}] Poll error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    };
    
    // Poll immediately then every 2 seconds
    pollProgress();
    pollIntervalRef.current = setInterval(pollProgress, 2000);
  };

  const processCompletedItems = (items: any[], requestId: string) => {
    addDebugLog(`[${requestId}] Processing ${items.length} completed items`);
    
    // Update file states
    setFiles(prev => prev.map((f, idx) => {
      const item = items.find(i => i.file_name === f.file.name);
      if (item) {
        const extractedData = item.extracted_data || {};
        return {
          ...f,
          detectedType: extractedData.classification?.type || 'UNKNOWN',
          detectedConfidence: extractedData.classification?.confidence || 0.5,
          detectedReasoning: `Processed via ${extractedData.extraction_method}`,
          isProcessed: true,
          processingError: item.status === 'failed' ? item.error_message : undefined,
        };
      }
      return f;
    }));

    // Convert to extracted entities
    const allEntities: ExtractedEntity[] = [];
    
    items.forEach((item, idx) => {
      if (item.status !== 'parsed' || !item.extracted_data?.parsed_data) {
        addDebugLog(`[${requestId}] Skipping ${item.file_name}: status=${item.status}`);
        return;
      }
      
      const parsedData = item.extracted_data.parsed_data;
      const classification = item.extracted_data.classification;
      const entityId = `entity-${idx}-${Date.now()}`;
      
      // Determine type and destination
      let entityType: EntityType = 'candidate';
      let destination: ExtractedEntity['destination'] = 'talent';
      
      if (classification?.type === 'BUSINESS_CARD') {
        entityType = 'contact';
        destination = 'contact';
      } else if (classification?.type === 'ORG_CHART') {
        entityType = 'org_node';
        destination = 'org_chart';
      } else if (classification?.type === 'NOTES_DOCUMENT') {
        entityType = 'notes';
        destination = 'notes';
      }
      
      // Check for duplicates
      let duplicateOf: string | undefined;
      const name = parsedData.personal?.full_name || parsedData.name;
      const email = parsedData.personal?.email || parsedData.email;
      if (name) {
        const dup = findDuplicate(name, email);
        if (dup) duplicateOf = dup.id;
      }

      allEntities.push({
        id: entityId,
        sourceFileIndex: idx,
        type: entityType,
        data: parsedData,
        confidence: item.parse_confidence || 0.5,
        missingFields: item.extracted_data.missing_fields || [],
        selected: true,
        destination,
        duplicateOf,
      });

      addDebugLog(`[${requestId}] Entity: ${name || 'Unknown'}, type=${entityType}, confidence=${(item.parse_confidence || 0).toFixed(2)}`);
    });

    setExtractedEntities(allEntities);
    setIsProcessing(false);

    // Show appropriate toast
    const succeeded = items.filter(i => i.status === 'parsed').length;
    const failed = items.filter(i => i.status === 'failed').length;
    
    if (allEntities.length > 0) {
      setStep('review');
      if (failed > 0) {
        toast.warning(`Extracted ${allEntities.length} entities. ${failed} file(s) had issues.`, {
          action: { label: 'Show Logs', onClick: () => setDebugOpen(true) }
        });
      } else {
        toast.success(`Extracted ${allEntities.length} entities from ${succeeded} file(s)`);
      }
    } else {
      if (failed > 0) {
        toast.error(`Could not extract data from ${failed} file(s)`, {
          action: { label: 'Show Logs', onClick: () => setDebugOpen(true) }
        });
      } else {
        toast.warning('No structured data could be extracted from the uploaded files');
      }
      setStep('review');
    }
  };

  const toggleEntitySelection = (id: string) => {
    setExtractedEntities(prev => 
      prev.map(e => e.id === id ? { ...e, selected: !e.selected } : e)
    );
  };

  const toggleAllSelection = (selected: boolean) => {
    setExtractedEntities(prev => prev.map(e => ({ ...e, selected })));
  };

  const updateEntityDestination = (id: string, destination: ExtractedEntity['destination']) => {
    setExtractedEntities(prev =>
      prev.map(e => e.id === id ? { ...e, destination } : e)
    );
  };

  const updateEntityData = (id: string, field: string, value: any) => {
    setExtractedEntities(prev =>
      prev.map(e => {
        if (e.id !== id) return e;
        return {
          ...e,
          data: { ...e.data, [field]: value }
        };
      })
    );
  };

  const handleProceedToRouting = () => {
    const selectedEntities = extractedEntities.filter(e => e.selected);
    
    if (selectedEntities.length === 0) {
      toast.error('Please select at least one entity to import');
      return;
    }

    // Check for missing required fields
    const candidatesWithNoName = selectedEntities.filter(
      e => e.type === 'candidate' && !e.data.personal?.full_name
    );
    if (candidatesWithNoName.length > 0) {
      toast.error('Some candidates are missing names. Please add names before continuing.');
      return;
    }

    setStep('routing');
  };

  const handleProceedToCompany = () => {
    const contactsNeedingCompany = extractedEntities.filter(
      e => e.selected && (e.destination === 'contact' || e.destination === 'org_chart')
    );

    if (contactsNeedingCompany.length === 0) {
      // No contacts need company assignment, proceed directly
      handleConfirmImport();
      return;
    }

    setStep('company');
  };

  const canConfirmImport = () => {
    if (companyAssignment === 'new' && !newCompanyData.name.trim()) {
      return false;
    }
    return true;
  };

  const handleConfirmImport = () => {
    if (!canConfirmImport()) {
      toast.error('Please provide a company name for the new company');
      return;
    }

    const selectedEntities = extractedEntities.filter(e => e.selected && e.destination !== 'skip');

    // Determine target account
    let targetAccount: Account | undefined;
    let companyName = 'Unassigned';

    if (companyAssignment === 'existing') {
      targetAccount = mockAccounts.find(acc => acc.id === selectedCompanyId);
      companyName = targetAccount?.name || mockAccount.name;
    } else if (companyAssignment === 'new') {
      const newCompany: Account = {
        id: `acc-${Date.now()}`,
        name: newCompanyData.name,
        industry: newCompanyData.industry || undefined,
        size: '',
        contacts: [],
        lastUpdated: new Date().toISOString().split('T')[0],
        engagementScore: 0,
      };
      mockAccounts.push(newCompany);
      targetAccount = newCompany;
      companyName = newCompanyData.name;
    }

    // Process entities by destination
    const newContacts: Contact[] = [];
    const newTalent: Talent[] = [];

    selectedEntities.forEach(entity => {
      if (entity.destination === 'talent') {
        // Create Talent record
        const candidateData = entity.data;
        const talent: Talent = {
          id: `talent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: candidateData.personal?.full_name || 'Unknown',
          email: candidateData.personal?.email || '',
          phone: candidateData.personal?.phone || '',
          skills: [...(candidateData.skills?.primary_skills || []), ...(candidateData.skills?.secondary_skills || [])],
          roleType: candidateData.headline?.current_title || '',
          seniority: candidateData.headline?.seniority_level || 'mid',
          availability: 'available',
          notes: candidateData.notes?.gaps?.join(', '),
          experience: candidateData.experience?.map((exp: any, idx: number) => ({
            id: `exp-${idx}`,
            company: exp.company,
            title: exp.title,
            startDate: exp.start_date || '',
            endDate: exp.end_date,
            current: !exp.end_date || exp.end_date.toLowerCase() === 'present',
            description: exp.summary,
          })),
          linkedIn: candidateData.personal?.linkedin_url,
          location: candidateData.personal?.location,
          lastUpdated: new Date().toISOString(),
          dataQuality: entity.missingFields.length > 2 ? 'needs-review' : 'parsed',
          status: 'new',
          cvSource: 'upload',
        };
        newTalent.push(talent);
        
        if (onTalentImportComplete) {
          onTalentImportComplete(talent);
        }
      } else if (entity.destination === 'contact' || entity.destination === 'org_chart') {
        // Create Contact record
        let contactData: any;
        if (entity.type === 'candidate') {
          contactData = {
            name: entity.data.personal?.full_name,
            email: entity.data.personal?.email,
            phone: entity.data.personal?.phone,
            title: entity.data.headline?.current_title,
          };
        } else if (entity.type === 'org_node') {
          const nodes = entity.data.nodes || [];
          nodes.forEach((node: any) => {
            const contact: Contact = {
              id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: node.name || 'Unknown',
              title: node.title || '',
              department: node.department || '',
              seniority: 'mid',
              email: '',
              phone: '',
              status: 'new',
              reportsTo: node.reports_to,
              lastContact: new Date().toISOString().split('T')[0],
            };
            newContacts.push(contact);
          });
          return; // Already processed
        } else {
          contactData = entity.data;
        }

        const contact: Contact = {
          id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: contactData.name || 'Unknown',
          title: contactData.title || '',
          department: contactData.department || '',
          seniority: 'mid',
          email: contactData.email || '',
          phone: contactData.phone || '',
          phoneNumbers: contactData.phone ? [{ value: contactData.phone, label: 'Work' as const, preferred: true }] : [],
          status: 'new',
          reportsTo: contactData.reportsTo,
          lastContact: new Date().toISOString().split('T')[0],
        };
        newContacts.push(contact);
      }
      // Notes destination - just log for now
      else if (entity.destination === 'notes') {
        addDebugLog(`Notes saved: ${JSON.stringify(entity.data).slice(0, 100)}...`);
      }
    });

    // Add contacts to target account
    if (newContacts.length > 0 && targetAccount) {
      newContacts.forEach(contact => {
        targetAccount!.contacts.push(contact);
      });
    }

    const summaryParts = [];
    if (newTalent.length > 0) summaryParts.push(`${newTalent.length} candidate(s) to Talent`);
    if (newContacts.length > 0) summaryParts.push(`${newContacts.length} contact(s) to ${companyName}`);

    toast.success(`Imported: ${summaryParts.join(', ')}`);
    
    if (onImportComplete && newContacts.length > 0) {
      onImportComplete(newContacts);
    }

    handleClose();
  };

  const getFileIcon = (type: FilePreview['type']) => {
    switch (type) {
      case 'image':
        return <FileImage className="h-8 w-8 text-blue-400" />;
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-400" />;
      default:
        return <FileText className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const selectedCount = extractedEntities.filter(e => e.selected).length;
  const duplicateCount = extractedEntities.filter(e => e.duplicateOf).length;
  const candidateCount = extractedEntities.filter(e => e.selected && e.type === 'candidate').length;
  const contactCount = extractedEntities.filter(e => e.selected && (e.type === 'contact' || e.type === 'org_node')).length;

  // Render entity name for display
  const getEntityName = (entity: ExtractedEntity): string => {
    if (entity.type === 'candidate') {
      return entity.data.personal?.full_name || 'Unknown Candidate';
    } else if (entity.type === 'contact') {
      return entity.data.name || 'Unknown Contact';
    } else if (entity.type === 'org_node') {
      return `Org Chart (${entity.data.nodes?.length || 0} people)`;
    } else if (entity.type === 'notes') {
      return `Meeting Notes (${entity.data.participants?.length || 0} participants)`;
    }
    return 'Unknown';
  };

  const getConfidenceLabel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Import
            {step !== 'upload' && (
              <Badge variant="secondary" className="ml-2">
                {extractedEntities.length} entities detected
              </Badge>
            )}
            {step === 'review' && candidateCount > 0 && (
              <Badge variant="outline" className="ml-2 border-blue-500 text-blue-500">
                {candidateCount} CV{candidateCount > 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' ? (
          <>
            <div className="flex-1 overflow-auto py-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 transition-all
                  ${isProcessing ? 'cursor-wait opacity-50' : 'cursor-pointer'}
                  ${isDragging 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.pptx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <FileUser className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <CreditCard className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="p-3 rounded-full bg-purple-500/10">
                      <Network className="h-6 w-6 text-purple-500" />
                    </div>
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <StickyNote className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium text-foreground">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      CVs, business cards, org charts, meeting notes • PDF, DOCX, images
                    </p>
                  </div>
                </div>
              </div>

              {/* File Previews with Type Override */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="relative group rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3"
                      >
                        {file.type === 'image' && file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.file.name}
                            className="h-12 w-12 object-cover rounded"
                          />
                        ) : (
                          getFileIcon(file.type)
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        
                        {/* Type override selector */}
                        <Select
                          value={file.userOverrideType || ''}
                          onValueChange={(v) => setFileTypeOverride(index, v as FileType)}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Auto-detect type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CV_RESUME">
                              <div className="flex items-center gap-2">
                                <FileUser className="h-3 w-3" />
                                CV / Resume
                              </div>
                            </SelectItem>
                            <SelectItem value="BUSINESS_CARD">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-3 w-3" />
                                Business Card
                              </div>
                            </SelectItem>
                            <SelectItem value="ORG_CHART">
                              <div className="flex items-center gap-2">
                                <Network className="h-3 w-3" />
                                Org Chart
                              </div>
                            </SelectItem>
                            <SelectItem value="NOTES_DOCUMENT">
                              <div className="flex items-center gap-2">
                                <StickyNote className="h-3 w-3" />
                                Meeting Notes
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {!isProcessing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="p-1 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">AI will extract:</strong> Candidate profiles from CVs, contacts from business cards, org structures from charts, and action items from notes. Each entity can be routed to the appropriate destination.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button 
                onClick={handleProcess}
                disabled={files.length === 0 || isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : step === 'review' ? (
          <>
            {/* Review Step */}
            <div className="flex-1 overflow-hidden flex flex-col py-2">
              {/* File Detection Summary */}
              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium">Detected Content:</p>
                <div className="flex flex-wrap gap-2">
                  {files.map((file, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
                        file.processingError ? 'border-red-500/50 bg-red-500/10' : 'border-border bg-muted/50'
                      }`}
                    >
                      {file.detectedType && fileTypeLabels[file.detectedType] && (
                        <span className={fileTypeLabels[file.detectedType].color}>
                          {fileTypeLabels[file.detectedType].icon}
                        </span>
                      )}
                      <span className="truncate max-w-[150px]">{file.file.name}</span>
                      {file.detectedConfidence && (
                        <Badge variant="outline" className="text-[10px] px-1">
                          {Math.round(file.detectedConfidence * 100)}%
                        </Badge>
                      )}
                      {file.processingError && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {duplicateCount > 0 && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-500">
                    {duplicateCount} potential duplicate{duplicateCount > 1 ? 's' : ''} detected
                  </span>
                </div>
              )}

              {/* Missing contact info warning for CVs */}
              {extractedEntities.some(e => e.type === 'candidate' && e.missingFields.includes('email') && e.missingFields.includes('phone')) && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-500">
                    Some CVs have no email/phone — you can add these manually or continue without
                  </span>
                </div>
              )}

              {/* Selection controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedCount === extractedEntities.length}
                    onCheckedChange={(checked) => toggleAllSelection(!!checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} of {extractedEntities.length} selected
                  </span>
                </div>
              </div>

              {/* Entities Table */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name / Content</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedEntities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No entities could be extracted. Check the debug panel below for details.
                        </TableCell>
                      </TableRow>
                    ) : (
                      extractedEntities.map((entity) => (
                        <TableRow 
                          key={entity.id}
                          className={entity.duplicateOf ? 'bg-yellow-500/5' : ''}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={entity.selected}
                              onCheckedChange={() => toggleEntitySelection(entity.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {entity.type === 'candidate' && <FileUser className="h-4 w-4 text-blue-500" />}
                              {entity.type === 'contact' && <Users className="h-4 w-4 text-green-500" />}
                              {entity.type === 'org_node' && <Network className="h-4 w-4 text-purple-500" />}
                              {entity.type === 'notes' && <StickyNote className="h-4 w-4 text-amber-500" />}
                              <span className="text-xs capitalize">{entity.type.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{getEntityName(entity)}</span>
                              {entity.duplicateOf && (
                                <span className="text-xs text-yellow-500">Possible duplicate</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {entity.type === 'candidate' && (
                                <>
                                  {entity.data.headline?.current_title && (
                                    <div>{entity.data.headline.current_title}</div>
                                  )}
                                  {entity.data.personal?.email && (
                                    <div>{entity.data.personal.email}</div>
                                  )}
                                  {entity.data.skills?.primary_skills?.slice(0, 3).join(', ')}
                                </>
                              )}
                              {entity.type === 'contact' && (
                                <>
                                  {entity.data.title && <div>{entity.data.title}</div>}
                                  {entity.data.company && <div>{entity.data.company}</div>}
                                  {entity.data.email && <div>{entity.data.email}</div>}
                                </>
                              )}
                              {entity.type === 'org_node' && (
                                <div>{entity.data.company_name || 'Unknown company'}</div>
                              )}
                              {entity.type === 'notes' && (
                                <div>{entity.data.summary?.slice(0, 60)}...</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={confidenceColors[getConfidenceLabel(entity.confidence)]}>
                              {Math.round(entity.confidence * 100)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entity.missingFields.length > 0 ? (
                              <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-500">
                                Missing: {entity.missingFields.slice(0, 2).join(', ')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-green-500 text-green-500">
                                Complete
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Debug Panel */}
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="mt-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs text-muted-foreground">Debug Logs ({debugLogs.length})</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 rounded-lg bg-black/80 border border-border max-h-[150px] overflow-auto">
                    <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap">
                      {debugLogs.length > 0 ? debugLogs.join('\n') : 'No logs yet'}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setStep('upload')}
                className="mr-auto gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleProceedToRouting}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                Next: Route Entities
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : step === 'routing' ? (
          <>
            {/* Routing Step */}
            <div className="flex-1 overflow-hidden flex flex-col py-2">
              <div className="mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  Where should each entity go?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose the destination for each extracted entity
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {extractedEntities.filter(e => e.selected).map((entity) => (
                    <div 
                      key={entity.id}
                      className="p-4 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {entity.type === 'candidate' && <FileUser className="h-4 w-4 text-blue-500" />}
                            {entity.type === 'contact' && <Users className="h-4 w-4 text-green-500" />}
                            {entity.type === 'org_node' && <Network className="h-4 w-4 text-purple-500" />}
                            {entity.type === 'notes' && <StickyNote className="h-4 w-4 text-amber-500" />}
                            <span className="font-medium">{getEntityName(entity)}</span>
                            <Badge variant="outline" className="text-[10px]">
                              from {files[entity.sourceFileIndex]?.file.name}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {entity.type === 'candidate' && (
                              <>
                                {entity.data.headline?.current_title && `${entity.data.headline.current_title} • `}
                                {entity.data.personal?.email || 'No email'}
                                {entity.missingFields.length > 0 && (
                                  <span className="text-yellow-500 ml-2">
                                    (Missing: {entity.missingFields.join(', ')})
                                  </span>
                                )}
                              </>
                            )}
                            {entity.type === 'contact' && (
                              <>
                                {entity.data.company && `${entity.data.company} • `}
                                {entity.data.email || entity.data.phone || 'No contact info'}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <Select
                          value={entity.destination}
                          onValueChange={(v) => updateEntityDestination(entity.id, v as ExtractedEntity['destination'])}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="talent">
                              <div className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4 text-blue-500" />
                                Save as Candidate
                              </div>
                            </SelectItem>
                            <SelectItem value="contact">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-green-500" />
                                Save as Contact
                              </div>
                            </SelectItem>
                            <SelectItem value="org_chart">
                              <div className="flex items-center gap-2">
                                <Network className="h-4 w-4 text-purple-500" />
                                Add to Org Chart
                              </div>
                            </SelectItem>
                            <SelectItem value="notes">
                              <div className="flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-amber-500" />
                                Save as Notes
                              </div>
                            </SelectItem>
                            <SelectItem value="skip">
                              <div className="flex items-center gap-2">
                                <X className="h-4 w-4 text-muted-foreground" />
                                Skip
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Summary */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Import summary:</span>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      {extractedEntities.filter(e => e.selected && e.destination === 'talent').length} candidates
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-green-500" />
                      {extractedEntities.filter(e => e.selected && (e.destination === 'contact' || e.destination === 'org_chart')).length} contacts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setStep('review')}
                className="mr-auto gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleProceedToCompany}
                className="gap-2"
              >
                {extractedEntities.some(e => e.selected && (e.destination === 'contact' || e.destination === 'org_chart')) ? (
                  <>
                    Next: Assign Company
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : step === 'company' ? (
          <>
            {/* Company Assignment Step */}
            <div className="flex-1 overflow-hidden flex flex-col py-2">
              <div className="mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  Which company should these contacts belong to?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {extractedEntities.filter(e => e.selected && (e.destination === 'contact' || e.destination === 'org_chart')).length} contact(s) need company assignment
                </p>
              </div>

              <RadioGroup 
                value={companyAssignment} 
                onValueChange={(v) => setCompanyAssignment(v as CompanyAssignment)}
                className="space-y-4"
              >
                {/* Option 1: Add to existing company */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="existing" id="existing" className="mt-1" />
                  <div className="flex-1 space-y-3">
                    <Label htmlFor="existing" className="text-sm font-medium cursor-pointer">
                      Add to existing company
                    </Label>
                    
                    {companyAssignment === 'existing' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search companies..."
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        
                        <ScrollArea className="h-[140px] border rounded-lg">
                          <div className="p-2 space-y-1">
                            {filteredCompanies.map((company) => (
                              <button
                                key={company.id}
                                type="button"
                                onClick={() => setSelectedCompanyId(company.id)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-3 ${
                                  selectedCompanyId === company.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                <Building2 className="h-4 w-4 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{company.name}</p>
                                  {company.industry && (
                                    <p className={`text-xs truncate ${
                                      selectedCompanyId === company.id 
                                        ? 'text-primary-foreground/80' 
                                        : 'text-muted-foreground'
                                    }`}>
                                      {company.industry}
                                    </p>
                                  )}
                                </div>
                                {selectedCompanyId === company.id && (
                                  <CheckCircle2 className="h-4 w-4 ml-auto shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>

                {/* Option 2: Create new company */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="new" id="new" className="mt-1" />
                  <div className="flex-1 space-y-3">
                    <Label htmlFor="new" className="text-sm font-medium cursor-pointer">
                      Create new company
                    </Label>
                    
                    {companyAssignment === 'new' && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company Name *</Label>
                          <Input
                            placeholder="Company name"
                            value={newCompanyData.name}
                            onChange={(e) => setNewCompanyData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Industry</Label>
                          <Input
                            placeholder="Industry"
                            value={newCompanyData.industry}
                            onChange={(e) => setNewCompanyData(prev => ({ ...prev, industry: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Location</Label>
                          <Input
                            placeholder="Location"
                            value={newCompanyData.location}
                            onChange={(e) => setNewCompanyData(prev => ({ ...prev, location: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Option 3: Unassigned */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="unassigned" id="unassigned" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="unassigned" className="text-sm font-medium cursor-pointer">
                      Leave unassigned
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contacts will be saved without a company association
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setStep('routing')}
                className="mr-auto gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmImport}
                disabled={!canConfirmImport()}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Import
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
