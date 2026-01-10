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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Contact, Account } from "@/lib/types";
import { mockAccount, mockAccounts } from "@/lib/mock-data";
import {
  departmentOptions,
  jobTitleOptionsFlat,
  seniorityOptions,
} from "@/lib/dropdown-options";

interface AIImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (contacts: Contact[]) => void;
  existingContacts?: Contact[];
  currentCompany?: string;
}

type FilePreview = {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'document';
};

type ExtractedContact = {
  id: string;
  name: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  reportsTo?: string;
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
  duplicateOf?: string; // ID of existing contact if potential duplicate
  isEditing?: boolean;
};

type ImportAction = 'new' | 'merge' | 'database-only' | 'database-and-chart' | 'notes-only';

type CompanyAssignment = 'existing' | 'new' | 'unassigned';

type NewCompanyData = {
  name: string;
  industry: string;
  location: string;
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
  existingContacts = mockAccount.contacts,
  currentCompany,
}: AIImportModalProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [sourceType, setSourceType] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'preview' | 'company'>('upload');
  const [selectedAction, setSelectedAction] = useState<ImportAction>('database-and-chart');
  
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
    setFiles([]);
    setIsDragging(false);
    setIsProcessing(false);
    setExtractedContacts([]);
    setSourceType('');
    setNotes('');
    setStep('upload');
    setSelectedAction('database-and-chart');
    setCompanyAssignment('existing');
    setSelectedCompanyId(currentCompany || mockAccount.id);
    setCompanySearch('');
    setNewCompanyData({ name: '', industry: '', location: '' });
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const findDuplicate = (name: string): Contact | undefined => {
    const normalizedName = name.toLowerCase().trim();
    return existingContacts.find(c => 
      c.name.toLowerCase().trim() === normalizedName ||
      c.name.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(c.name.toLowerCase())
    );
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const allExtracted: ExtractedContact[] = [];

    try {
      // Process each image file
      for (const fileData of files) {
        if (fileData.type === 'image') {
          const base64 = await fileToBase64(fileData.file);
          
          const { data, error } = await supabase.functions.invoke('ai-extract-contacts', {
            body: { 
              imageBase64: base64,
              mimeType: fileData.file.type 
            }
          });

          if (error) {
            console.error('AI extraction error:', error);
            toast.error(`Failed to process ${fileData.file.name}`);
            continue;
          }

          if (data?.success && data?.data?.contacts) {
            const contacts = data.data.contacts.map((c: any, idx: number) => {
              const duplicate = findDuplicate(c.name);
              return {
                id: `extracted-${Date.now()}-${idx}`,
                name: c.name || 'Unknown',
                title: c.title,
                department: c.department,
                email: c.email,
                phone: c.phone,
                reportsTo: c.reportsTo,
                confidence: c.confidence || 'medium',
                selected: true,
                duplicateOf: duplicate?.id,
                isEditing: false,
              };
            });
            
            allExtracted.push(...contacts);
            
            if (data.data.sourceType) {
              setSourceType(data.data.sourceType);
            }
            if (data.data.notes) {
              setNotes(data.data.notes);
            }
          }
        } else {
          toast.info(`${fileData.file.name} is not an image - PDF extraction coming soon`);
        }
      }

      if (allExtracted.length > 0) {
        setExtractedContacts(allExtracted);
        setStep('preview');
        toast.success(`Found ${allExtracted.length} contacts`);
      } else {
        toast.error('No contacts found in the uploaded files');
      }
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleContactSelection = (id: string) => {
    setExtractedContacts(prev => 
      prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c)
    );
  };

  const toggleAllSelection = (selected: boolean) => {
    setExtractedContacts(prev => prev.map(c => ({ ...c, selected })));
  };

  const updateContactField = (id: string, field: keyof ExtractedContact, value: string) => {
    setExtractedContacts(prev =>
      prev.map(c => c.id === id ? { ...c, [field]: value } : c)
    );
  };

  const handleProceedToCompany = () => {
    const selectedContacts = extractedContacts.filter(c => c.selected);
    
    if (selectedContacts.length === 0) {
      toast.error('Please select at least one contact to import');
      return;
    }

    // Validate required fields for org chart
    if (selectedAction === 'database-and-chart') {
      const incomplete = selectedContacts.filter(c => !c.department || !c.title);
      if (incomplete.length > 0) {
        toast.error(`${incomplete.length} contacts are missing Department or Job Title required for org chart`);
        return;
      }
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

    const selectedContacts = extractedContacts.filter(c => c.selected);

    // Determine target account
    let targetAccount: Account | undefined;
    let companyName = 'Unassigned';

    if (companyAssignment === 'existing') {
      targetAccount = mockAccounts.find(acc => acc.id === selectedCompanyId);
      companyName = targetAccount?.name || mockAccount.name;
    } else if (companyAssignment === 'new') {
      // Create new company (in real implementation, this would persist)
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

    // Convert to Contact type and add to mock data
    const newContacts: Contact[] = selectedContacts.map(ec => ({
      id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: ec.name,
      title: ec.title || '',
      department: ec.department || '',
      seniority: 'mid' as const,
      email: ec.email || '',
      phone: ec.phone || '',
      phoneNumbers: ec.phone ? [{ value: ec.phone, label: 'Work' as const, preferred: true }] : [],
      status: 'new' as const,
      reportsTo: ec.reportsTo,
      lastContact: new Date().toISOString().split('T')[0],
    }));

    // Add to target account based on action
    if (selectedAction !== 'notes-only' && targetAccount) {
      newContacts.forEach(contact => {
        targetAccount!.contacts.push(contact);
      });
    } else if (selectedAction !== 'notes-only' && companyAssignment !== 'unassigned') {
      // Fallback to current mockAccount
      newContacts.forEach(contact => {
        mockAccount.contacts.push(contact);
      });
    }

    const assignmentText = companyAssignment === 'unassigned' 
      ? ' (unassigned)' 
      : ` to ${companyName}`;

    const actionMessages: Record<ImportAction, string> = {
      'new': `Added ${newContacts.length} new contacts${assignmentText}`,
      'merge': `Merged ${newContacts.length} contacts${assignmentText}`,
      'database-only': `Added ${newContacts.length} contacts to database${assignmentText}`,
      'database-and-chart': `Added ${newContacts.length} contacts to database and org chart${assignmentText}`,
      'notes-only': `Saved ${newContacts.length} contacts as notes`,
    };

    toast.success(actionMessages[selectedAction]);
    
    if (onImportComplete) {
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

  const selectedCount = extractedContacts.filter(c => c.selected).length;
  const duplicateCount = extractedContacts.filter(c => c.duplicateOf).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Import
            {(step === 'preview' || step === 'company') && (
              <Badge variant="secondary" className="ml-2">
                {extractedContacts.length} contacts detected
              </Badge>
            )}
            {step === 'company' && (
              <Badge variant="outline" className="ml-2">
                Step 3: Assign Company
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
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <Image className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="p-3 rounded-full bg-red-500/10">
                      <FileText className="h-6 w-6 text-red-500" />
                    </div>
                    <div className="p-3 rounded-full bg-purple-500/10">
                      <Building2 className="h-6 w-6 text-purple-500" />
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <Camera className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium text-foreground">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports images, PDFs, screenshots, org charts, and business cards
                    </p>
                  </div>
                </div>
              </div>

              {/* File Previews */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="grid grid-cols-2 gap-3">
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
                        {!isProcessing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <X className="h-3 w-3" />
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
                  <strong className="text-foreground">AI will extract:</strong> Names, job titles, departments, emails, phone numbers, and reporting relationships from your files. Review and confirm before saving.
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
        ) : step === 'preview' ? (
          <>
            {/* Preview Step */}
            <div className="flex-1 overflow-hidden flex flex-col py-2">
              {/* Source info */}
              {sourceType && (
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Detected source: <strong className="text-foreground capitalize">{sourceType.replace('_', ' ')}</strong></span>
                  {notes && <span className="text-xs">• {notes}</span>}
                </div>
              )}

              {/* Warnings */}
              {duplicateCount > 0 && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-500">
                    {duplicateCount} potential duplicate{duplicateCount > 1 ? 's' : ''} detected
                  </span>
                </div>
              )}

              {/* Selection controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedCount === extractedContacts.length}
                    onCheckedChange={(checked) => toggleAllSelection(!!checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} of {extractedContacts.length} selected
                  </span>
                </div>
              </div>

              {/* Contacts Table */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedContacts.map((contact) => (
                      <TableRow 
                        key={contact.id}
                        className={contact.duplicateOf ? 'bg-yellow-500/5' : ''}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={contact.selected}
                            onCheckedChange={() => toggleContactSelection(contact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Input
                              value={contact.name}
                              onChange={(e) => updateContactField(contact.id, 'name', e.target.value)}
                              className="h-7 text-sm font-medium"
                            />
                            {contact.duplicateOf && (
                              <span className="text-xs text-yellow-500 mt-1">
                                Possible duplicate
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={contact.department || ''} 
                            onValueChange={(v) => updateContactField(contact.id, 'department', v)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contact.department && !(departmentOptions as readonly string[]).includes(contact.department) && (
                                <SelectItem value={contact.department} className="text-xs">
                                  {contact.department}
                                </SelectItem>
                              )}
                              {departmentOptions.map((dept) => (
                                <SelectItem key={dept} value={dept} className="text-xs">
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={contact.title || ''} 
                            onValueChange={(v) => updateContactField(contact.id, 'title', v)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {contact.title && !(jobTitleOptionsFlat as readonly string[]).includes(contact.title) && (
                                <SelectItem value={contact.title} className="text-xs">
                                  {contact.title}
                                </SelectItem>
                              )}
                              {jobTitleOptionsFlat.map((title) => (
                                <SelectItem key={title} value={title} className="text-xs">
                                  {title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contact.email || ''}
                            onChange={(e) => updateContactField(contact.id, 'email', e.target.value)}
                            className="h-7 text-xs"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contact.phone || ''}
                            onChange={(e) => updateContactField(contact.id, 'phone', e.target.value)}
                            className="h-7 text-xs"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={confidenceColors[contact.confidence]}>
                            {contact.confidence}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contact.selected && (!contact.department || !contact.title) && (
                            <span title="Missing required fields">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Action Selection */}
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <p className="text-sm font-medium">What would you like to do?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedAction === 'database-and-chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAction('database-and-chart')}
                    className="justify-start gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Add to Database + Org Chart
                  </Button>
                  <Button
                    variant={selectedAction === 'database-only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAction('database-only')}
                    className="justify-start gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Add to Database Only
                  </Button>
                  <Button
                    variant={selectedAction === 'new' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAction('new')}
                    className="justify-start gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Add as New Contacts
                  </Button>
                  <Button
                    variant={selectedAction === 'notes-only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAction('notes-only')}
                    className="justify-start gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Save as Notes Only
                  </Button>
                </div>
              </div>
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
                onClick={handleProceedToCompany}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                Next: Assign Company
                <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : step === 'company' ? (
          <>
            {/* Company Assignment Step */}
            <div className="flex-1 overflow-hidden flex flex-col py-2">
              <div className="mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  Where should these contacts be added?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCount} contact{selectedCount > 1 ? 's' : ''} selected for import
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
                      <div className="space-y-2 pl-0">
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
                            {filteredCompanies.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No companies found
                              </p>
                            )}
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
                    <Label htmlFor="new" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create new company
                    </Label>
                    
                    {companyAssignment === 'new' && (
                      <div className="space-y-3 pl-0">
                        <div className="space-y-2">
                          <Label htmlFor="company-name" className="text-xs text-muted-foreground">
                            Company Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="company-name"
                            placeholder="Enter company name..."
                            value={newCompanyData.name}
                            onChange={(e) => setNewCompanyData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="company-industry" className="text-xs text-muted-foreground flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              Industry (optional)
                            </Label>
                            <Input
                              id="company-industry"
                              placeholder="e.g., Software, Finance..."
                              value={newCompanyData.industry}
                              onChange={(e) => setNewCompanyData(prev => ({ ...prev, industry: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company-location" className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Location (optional)
                            </Label>
                            <Input
                              id="company-location"
                              placeholder="e.g., New York, NY..."
                              value={newCompanyData.location}
                              onChange={(e) => setNewCompanyData(prev => ({ ...prev, location: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Option 3: Save as unassigned */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="unassigned" id="unassigned" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="unassigned" className="text-sm font-medium cursor-pointer">
                      Save as unassigned contacts
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contacts remain searchable and can be linked to a company later
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* Summary */}
              <div className="mt-auto pt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Action:</span>
                  <span className="font-medium">
                    {selectedAction === 'database-and-chart' && 'Add to Database + Org Chart'}
                    {selectedAction === 'database-only' && 'Add to Database Only'}
                    {selectedAction === 'new' && 'Add as New Contacts'}
                    {selectedAction === 'notes-only' && 'Save as Notes Only'}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setStep('preview')}
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
                Confirm Import ({selectedCount})
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
