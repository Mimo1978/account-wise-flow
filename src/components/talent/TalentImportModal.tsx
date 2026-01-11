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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  X, 
  Sparkles,
  FileImage,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Upload,
  Briefcase,
  Tags,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Talent, TalentExperience, TalentAvailability, TalentStatus } from "@/lib/types";

interface TalentImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (talent: Talent) => void;
}

type FilePreview = {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'document';
};

type ExtractedTalent = {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  roleType: string;
  seniority: "executive" | "director" | "manager" | "senior" | "mid" | "junior";
  skills: string[];
  aiOverview: string;
  experience: TalentExperience[];
  confidence: 'high' | 'medium' | 'low';
};

const seniorityOptions = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-Level" },
  { value: "senior", label: "Senior" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "executive", label: "Executive" },
];

const availabilityOptions: { value: TalentAvailability; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "interviewing", label: "Interviewing" },
  { value: "deployed", label: "Deployed" },
];

const statusOptions: { value: TalentStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "archived", label: "Archived" },
];

const confidenceColors: Record<string, string> = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-red-500/20 text-red-400',
};

export const TalentImportModal = ({
  open,
  onOpenChange,
  onImportComplete,
}: TalentImportModalProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedTalent, setExtractedTalent] = useState<ExtractedTalent | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'finalize'>('upload');
  
  // Editable fields for preview
  const [editedTalent, setEditedTalent] = useState<ExtractedTalent | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [availability, setAvailability] = useState<TalentAvailability>("available");
  const [status, setStatus] = useState<TalentStatus>("new");
  const [rate, setRate] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setFiles([]);
    setIsDragging(false);
    setIsProcessing(false);
    setExtractedTalent(null);
    setEditedTalent(null);
    setStep('upload');
    setNewSkill("");
    setAvailability("available");
    setStatus("new");
    setRate("");
    onOpenChange(false);
  };

  const getFileType = (file: File): 'image' | 'pdf' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.docx')
    ) {
      return 'document';
    }
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
    
    // Only keep the first file for CV import
    setFiles(newFiles.slice(0, 1));
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

  const removeFile = () => {
    if (files[0]?.preview) {
      URL.revokeObjectURL(files[0].preview);
    }
    setFiles([]);
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

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    try {
      const fileData = files[0];
      
      if (fileData.type === 'image') {
        const base64 = await fileToBase64(fileData.file);
        
        const { data, error } = await supabase.functions.invoke('ai-extract-cv', {
          body: { 
            imageBase64: base64,
            mimeType: fileData.file.type 
          }
        });

        if (error) {
          console.error('AI extraction error:', error);
          toast.error('Failed to process CV');
          return;
        }

        if (data?.success && data?.data?.talent) {
          const talent = data.data.talent;
          // Add IDs to experience entries
          const experienceWithIds = (talent.experience || []).map((exp: any, idx: number) => ({
            ...exp,
            id: `exp-${Date.now()}-${idx}`,
          }));
          
          const extractedData: ExtractedTalent = {
            name: talent.name || 'Unknown',
            email: talent.email,
            phone: talent.phone,
            location: talent.location,
            linkedIn: talent.linkedIn,
            roleType: talent.roleType || 'Unknown Role',
            seniority: talent.seniority || 'mid',
            skills: talent.skills || [],
            aiOverview: talent.aiOverview || '',
            experience: experienceWithIds,
            confidence: talent.confidence || 'medium',
          };
          
          setExtractedTalent(extractedData);
          setEditedTalent(extractedData);
          setStep('preview');
          toast.success('CV parsed successfully');
        } else {
          toast.error('Could not extract talent information from CV');
        }
      } else if (fileData.type === 'pdf' || fileData.type === 'document') {
        toast.info('PDF/DOC parsing coming soon - please use an image or screenshot of the CV for now');
      }
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Failed to process CV');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateField = (field: keyof ExtractedTalent, value: any) => {
    if (editedTalent) {
      setEditedTalent({ ...editedTalent, [field]: value });
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && editedTalent) {
      if (!editedTalent.skills.includes(newSkill.trim())) {
        setEditedTalent({
          ...editedTalent,
          skills: [...editedTalent.skills, newSkill.trim()],
        });
      }
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    if (editedTalent) {
      setEditedTalent({
        ...editedTalent,
        skills: editedTalent.skills.filter(s => s !== skill),
      });
    }
  };

  const handleProceedToFinalize = () => {
    if (!editedTalent?.name || !editedTalent?.roleType) {
      toast.error('Name and Primary Role are required');
      return;
    }
    setStep('finalize');
  };

  const handleConfirmImport = () => {
    if (!editedTalent) return;

    const newTalent: Talent = {
      id: `t-${Date.now()}`,
      name: editedTalent.name,
      email: editedTalent.email || '',
      phone: editedTalent.phone || '',
      phoneNumbers: editedTalent.phone ? [{ value: editedTalent.phone, label: 'Mobile', preferred: true }] : [],
      skills: editedTalent.skills,
      roleType: editedTalent.roleType,
      seniority: editedTalent.seniority,
      availability,
      rate: rate || undefined,
      aiOverview: editedTalent.aiOverview,
      experience: editedTalent.experience,
      linkedIn: editedTalent.linkedIn,
      location: editedTalent.location,
      lastUpdated: new Date().toISOString().split('T')[0],
      dataQuality: editedTalent.confidence === 'high' ? 'parsed' : 'needs-review',
      status,
    };

    toast.success(`Imported ${newTalent.name} to talent database`);
    
    if (onImportComplete) {
      onImportComplete(newTalent);
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    if (!month) return year;
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import CV / Resume
            {step !== 'upload' && editedTalent && (
              <Badge variant="secondary" className="ml-2">
                {editedTalent.name}
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
                  accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">Drop CV/Resume here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      PDF
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      DOC / DOCX
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <FileImage className="h-3 w-3 mr-1" />
                      Image
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <FileImage className="h-3 w-3 mr-1" />
                      Screenshot
                    </Badge>
                  </div>
                </div>
              </div>

              {/* File Preview */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm text-muted-foreground">Selected File</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    {files[0].type === 'image' && files[0].preview ? (
                      <img 
                        src={files[0].preview} 
                        alt="CV preview" 
                        className="h-16 w-16 object-cover rounded"
                      />
                    ) : (
                      getFileIcon(files[0].type)
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{files[0].file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(files[0].file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={handleProcess} 
                disabled={files.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Extract with AI
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : step === 'preview' && editedTalent ? (
          <>
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="space-y-6 pr-4 py-4">
                {/* Confidence Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={confidenceColors[editedTalent.confidence]}>
                    {editedTalent.confidence === 'high' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                    {editedTalent.confidence} confidence
                  </Badge>
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editedTalent.name}
                        onChange={(e) => updateField('name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Role *</Label>
                      <Input
                        value={editedTalent.roleType}
                        onChange={(e) => updateField('roleType', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editedTalent.email || ''}
                        onChange={(e) => updateField('email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editedTalent.phone || ''}
                        onChange={(e) => updateField('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={editedTalent.location || ''}
                        onChange={(e) => updateField('location', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seniority</Label>
                      <Select
                        value={editedTalent.seniority}
                        onValueChange={(value) => updateField('seniority', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {seniorityOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* AI Overview */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Overview
                  </Label>
                  <Textarea
                    value={editedTalent.aiOverview}
                    onChange={(e) => updateField('aiOverview', e.target.value)}
                    className="min-h-[80px] resize-none"
                    placeholder="AI-generated candidate summary..."
                  />
                </div>

                <Separator />

                {/* Skills */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Skills ({editedTalent.skills.length})
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editedTalent.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1">
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                    }
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add skill..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    />
                    <Button variant="outline" size="sm" onClick={addSkill}>
                      Add
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Experience */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Experience ({editedTalent.experience.length})
                  </Label>
                  <div className="space-y-3">
                    {editedTalent.experience.map((exp, idx) => (
                      <div key={exp.id || idx} className="p-3 rounded-lg bg-muted/50 border space-y-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{exp.title}</p>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(exp.startDate)} - {exp.current ? 'Present' : formatDate(exp.endDate || '')}
                          </div>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-muted-foreground">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleProceedToFinalize}>
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        ) : step === 'finalize' && editedTalent ? (
          <>
            <div className="flex-1 overflow-auto py-4 space-y-6">
              {/* Summary Card */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{editedTalent.name}</p>
                    <p className="text-sm text-muted-foreground">{editedTalent.roleType}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{editedTalent.skills.length} skills</Badge>
                  <Badge variant="outline">{editedTalent.experience.length} experiences</Badge>
                </div>
              </div>

              {/* Final Settings */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <Select value={availability} onValueChange={(v) => setAvailability(v as TalentAvailability)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availabilityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as TalentStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rate (optional)</Label>
                  <Input
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g., $150/hr"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setStep('preview')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleConfirmImport}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Import Talent
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
