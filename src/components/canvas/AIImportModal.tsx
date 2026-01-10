import { useState, useRef, useCallback } from "react";
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
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/lib/types";
import { mockAccount } from "@/lib/mock-data";
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
}: AIImportModalProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [sourceType, setSourceType] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [selectedAction, setSelectedAction] = useState<ImportAction>('database-and-chart');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setFiles([]);
    setIsDragging(false);
    setIsProcessing(false);
    setExtractedContacts([]);
    setSourceType('');
    setNotes('');
    setStep('upload');
    setSelectedAction('database-and-chart');
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

  const handleConfirmImport = () => {
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

    // Add to mock account based on action
    if (selectedAction !== 'notes-only') {
      newContacts.forEach(contact => {
        mockAccount.contacts.push(contact);
      });
    }

    const actionMessages: Record<ImportAction, string> = {
      'new': `Added ${newContacts.length} new contacts`,
      'merge': `Merged ${newContacts.length} contacts`,
      'database-only': `Added ${newContacts.length} contacts to database`,
      'database-and-chart': `Added ${newContacts.length} contacts to database and org chart`,
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
            {step === 'preview' && (
              <Badge variant="secondary" className="ml-2">
                {extractedContacts.length} contacts detected
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
        ) : (
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
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Import ({selectedCount})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
