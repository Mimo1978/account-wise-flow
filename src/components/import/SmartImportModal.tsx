import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Upload,
  FileText, 
  X, 
  XCircle,
  Sparkles,
  FileImage,
  Building2,
  Loader2,
  CheckCircle2,
  Users,
  FileUser,
  Network,
  StickyNote,
  CreditCard,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Bug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useSmartImport, 
  SmartImportContext, 
  FileType,
  ImportSource 
} from "@/hooks/use-smart-import";
import { useState } from "react";

interface SmartImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SmartImportContext;
  onComplete?: () => void;
}

const fileTypeConfig: Record<FileType, { label: string; icon: React.ReactNode; color: string }> = {
  CV_RESUME: { label: 'CV / Resume', icon: <FileUser className="h-4 w-4" />, color: 'text-blue-500' },
  BUSINESS_CARD: { label: 'Business Card', icon: <CreditCard className="h-4 w-4" />, color: 'text-green-500' },
  ORG_CHART: { label: 'Org Chart', icon: <Network className="h-4 w-4" />, color: 'text-purple-500' },
  NOTES_DOCUMENT: { label: 'Notes', icon: <StickyNote className="h-4 w-4" />, color: 'text-amber-500' },
  UNKNOWN: { label: 'Unknown', icon: <HelpCircle className="h-4 w-4" />, color: 'text-muted-foreground' },
};

const sourceLabels: Record<ImportSource, { label: string; description: string }> = {
  CANVAS: { label: 'Company Canvas', description: 'Import contacts to this company' },
  TALENT: { label: 'Talent Database', description: 'Import candidates' },
  CONTACT: { label: 'Contacts', description: 'Import contacts' },
  COMPANY: { label: 'Company', description: 'Import to this company' },
};

export function SmartImportModal({ 
  open, 
  onOpenChange, 
  context,
  onComplete 
}: SmartImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const {
    files,
    rejectedFiles,
    isProcessing,
    batchId,
    progress,
    step,
    debugLogs,
    addFiles,
    removeFile,
    clearFiles,
    dismissRejected,
    setFileTypeOverride,
    processFiles,
    reset,
    navigateToReview,
  } = useSmartImport(context);

  const handleClose = useCallback(() => {
    if (!isProcessing) reset();
    onOpenChange(false);
  }, [isProcessing, reset, onOpenChange]);

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
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const handleProcess = async () => {
    await processFiles(() => {
      onComplete?.();
      onOpenChange(false);
    });
  };

  const getFileIcon = (type: 'image' | 'pdf' | 'document') => {
    switch (type) {
      case 'image':
        return <FileImage className="h-5 w-5 text-blue-400" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-400" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const progressPercent = progress 
    ? (progress.processed / Math.max(progress.total, 1)) * 100 
    : 0;

  const sourceInfo = sourceLabels[context.source];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Import
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {sourceInfo.label}
            </Badge>
          </DialogTitle>
          {context.companyName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <Building2 className="h-4 w-4" />
              <span>Importing to: {context.companyName}</span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && (
            <div className="space-y-4 py-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
                  isProcessing && "cursor-wait opacity-50",
                  isDragging 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">Drop files here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Badge variant="outline" className="text-xs">
                      <FileUser className="h-3 w-3 mr-1" />
                      CV / Resume
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Business Card
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Network className="h-3 w-3 mr-1" />
                      Org Chart
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <StickyNote className="h-3 w-3 mr-1" />
                      Notes
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Context Info */}
              <div className="bg-muted/30 rounded-lg p-3 border border-muted">
                <p className="text-sm text-muted-foreground">
                  <strong>Import mode:</strong> {sourceInfo.description}.{' '}
                  {context.source === 'CANVAS' || context.source === 'COMPANY' 
                    ? 'CVs will be saved as Candidates with a link to this company. Business cards become Contacts on the org chart.'
                    : context.source === 'TALENT'
                    ? 'Files will be processed as candidate profiles with CV attachment.'
                    : 'Files will be processed as contacts with optional company linking.'}
                </p>
              </div>

              {/* Batch size warning */}
              {files.length > 10 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Processing large batches can take several minutes. For best results, import up to 10 CVs at a time. You have {files.length} selected.
                  </p>
                </div>
              )}

              {/* Files List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={clearFiles}>
                      Clear all
                    </Button>
                  </div>
                  <ScrollArea className="h-48 border rounded-md">
                    <div className="p-2 space-y-1">
                      {files.map((file, idx) => (
                        <div
                          key={`${file.file.name}-${idx}`}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group"
                        >
                          {file.type === 'image' && file.preview ? (
                            <img 
                              src={file.preview} 
                              alt="Preview" 
                              className="h-10 w-10 object-cover rounded"
                            />
                          ) : (
                            getFileIcon(file.type)
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Select
                            value={file.userOverrideType || 'auto'}
                            onValueChange={(v) => setFileTypeOverride(idx, v as FileType)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Auto-detect" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto-detect</SelectItem>
                              <SelectItem value="CV_RESUME">CV / Resume</SelectItem>
                              <SelectItem value="BUSINESS_CARD">Business Card</SelectItem>
                              <SelectItem value="ORG_CHART">Org Chart</SelectItem>
                              <SelectItem value="NOTES_DOCUMENT">Notes</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={() => removeFile(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Rejected files */}
              {rejectedFiles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
                    Rejected ({rejectedFiles.length})
                  </span>
                  {rejectedFiles.map((r, idx) => (
                    <div
                      key={`rejected-${idx}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-sm"
                    >
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-red-400">
                        {r.error}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => dismissRejected(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'processing' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10 animate-pulse">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <p className="text-lg font-medium">Processing files...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI is extracting contacts and candidates
                  </p>
                </div>
              </div>

              {progress && (
                <div className="space-y-3">
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {progress.processed} / {progress.total} files
                    </span>
                    <div className="flex items-center gap-3">
                      {progress.succeeded > 0 && (
                        <span className="flex items-center gap-1 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          {progress.succeeded}
                        </span>
                      )}
                      {progress.failed > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-4 w-4" />
                          {progress.failed}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {batchId && (
                <div className="flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={navigateToReview}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Import Review
                  </Button>
                </div>
              )}

              {/* Debug Logs */}
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                    <Bug className="h-4 w-4" />
                    Debug Logs
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      debugOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-32 border rounded-md mt-2 p-2">
                    <div className="space-y-1 font-mono text-xs">
                      {debugLogs.map((log, i) => (
                        <p key={i} className="text-muted-foreground">{log}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-medium">Processing complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Redirecting to review screen...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
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
                    Process with AI
                    {files.length > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        — {files.length <= 3 ? '~30 seconds' : files.length <= 10 ? '~2 minutes' : 'may take 5+ minutes'}
                      </span>
                    )}
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'processing' && (
            <p className="text-sm text-muted-foreground">
              You can close this modal — processing will continue in the background
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
