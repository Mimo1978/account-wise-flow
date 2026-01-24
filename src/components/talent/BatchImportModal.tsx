import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
  FolderUp,
  Users,
  AlertTriangle,
  Search,
  Eye,
  GitMerge,
  PlusCircle,
  Link2,
  Database,
  CloudUpload,
  Briefcase,
  GraduationCap,
  Mail,
  Phone,
  MapPin,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCVBatchImport, CVImportItem, ItemStatus, BatchStatus } from "@/hooks/use-cv-batch-import";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BatchImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILES = 20000;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type Step = "select" | "upload" | "processing" | "review";
type TabValue = "upload" | "background";

const statusConfig: Record<ItemStatus, { label: string; color: string; icon: React.ReactNode }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: { label: "Processing", color: "bg-blue-500/20 text-blue-400", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  parsed: { label: "Parsed", color: "bg-green-500/20 text-green-400", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  dedupe_review: { label: "Review Needed", color: "bg-yellow-500/20 text-yellow-400", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  merged: { label: "Merged", color: "bg-purple-500/20 text-purple-400", icon: <Users className="h-3.5 w-3.5" /> },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400", icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

const batchStatusConfig: Record<BatchStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "bg-muted" },
  processing: { label: "Processing", color: "bg-blue-500/20 text-blue-400" },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-400" },
  partial: { label: "Partial", color: "bg-yellow-500/20 text-yellow-400" },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-400" },
};

export function BatchImportModal({ open, onOpenChange, onImportComplete }: BatchImportModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [activeTab, setActiveTab] = useState<TabValue>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CVImportItem | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  
  // Background import form
  const [datasetName, setDatasetName] = useState("");
  const [datasetNotes, setDatasetNotes] = useState("");
  const [isSubmittingBackground, setIsSubmittingBackground] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const {
    isCreatingBatch,
    isUploading,
    uploadProgress,
    currentBatch,
    items,
    itemsPagination,
    createBatch,
    uploadFiles,
    completeUpload,
    fetchBatch,
    fetchItems,
    retryItem,
    resolveDedupe,
  } = useCVBatchImport();

  // Poll for updates when processing
  useEffect(() => {
    if (step === "processing" && currentBatch?.id) {
      const poll = async () => {
        await fetchBatch(currentBatch.id);
        await fetchItems(currentBatch.id, currentPage, 50, statusFilter === "all" ? undefined : statusFilter);
      };

      // Initial fetch
      poll();

      // Poll every 3 seconds
      pollIntervalRef.current = window.setInterval(poll, 3000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [step, currentBatch?.id, currentPage, statusFilter, fetchBatch, fetchItems]);

  // Transition to review when complete
  useEffect(() => {
    if (currentBatch && ["completed", "partial", "failed"].includes(currentBatch.status)) {
      setStep("review");
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
  }, [currentBatch?.status]);

  const handleClose = useCallback(() => {
    if (isUploading || isCreatingBatch) return;
    
    setStep("select");
    setActiveTab("upload");
    setFiles([]);
    setStatusFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
    setSelectedItem(null);
    setShowDetailPanel(false);
    setDatasetName("");
    setDatasetNotes("");
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    onOpenChange(false);
  }, [isUploading, isCreatingBatch, onOpenChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    
    setFiles((prev) => {
      const combined = [...prev, ...droppedFiles];
      return combined.slice(0, MAX_FILES);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );
    
    setFiles((prev) => {
      const combined = [...prev, ...selectedFiles];
      return combined.slice(0, MAX_FILES);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartImport = async () => {
    if (files.length === 0) return;

    // Create batch
    const result = await createBatch(files.length);
    if (!result) return;

    setStep("upload");

    // Upload files
    const success = await uploadFiles(
      files,
      result.batch.id,
      result.uploadPath,
      result.maxConcurrentUploads
    );

    if (!success) {
      // Some files failed but continue anyway
    }

    // Start processing
    await completeUpload(result.batch.id);
    setStep("processing");
  };

  const handleRetryFailed = async () => {
    if (!currentBatch) return;
    
    const failedItems = items.filter((i) => i.status === "failed");
    for (const item of failedItems) {
      await retryItem(item.id);
    }
    
    // Refetch
    await fetchItems(currentBatch.id, currentPage, 50, statusFilter === "all" ? undefined : statusFilter);
  };

  const handleDone = () => {
    onImportComplete?.();
    handleClose();
  };

  const handleViewItem = (item: CVImportItem) => {
    setSelectedItem(item);
    setShowDetailPanel(true);
  };

  const handleResolveDedupe = async (action: "create_new" | "merge_into" | "link_existing", candidateId?: string) => {
    if (!selectedItem) return;
    
    const success = await resolveDedupe(selectedItem.id, action, candidateId);
    if (success) {
      setShowDetailPanel(false);
      setSelectedItem(null);
      // Refetch items
      if (currentBatch) {
        await fetchItems(currentBatch.id, currentPage, 50, statusFilter === "all" ? undefined : statusFilter);
      }
    }
  };

  const handleSubmitBackgroundImport = async () => {
    if (!datasetName.trim()) {
      toast.error("Please enter a dataset name");
      return;
    }

    setIsSubmittingBackground(true);
    try {
      // Create a batch in queued state for background processing
      const result = await createBatch(0); // 0 files = placeholder batch
      if (result) {
        toast.success("Import request submitted. Your batch is queued for processing.");
        handleClose();
      }
    } catch (error) {
      toast.error("Failed to submit import request");
    } finally {
      setIsSubmittingBackground(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const progressPercent = currentBatch
    ? (currentBatch.processed_files / currentBatch.total_files) * 100
    : 0;

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch = !searchQuery || 
      item.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.extracted_data as any)?.personal?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const needsReviewCount = items.filter((i) => i.status === "dedupe_review").length;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderUp className="h-5 w-5 text-primary" />
              Batch CV Import
            </DialogTitle>
            <DialogDescription>
              {step === "select" && "Upload multiple CVs or request a large dataset import"}
              {step === "upload" && "Uploading your files..."}
              {step === "processing" && "Processing your CVs..."}
              {step === "review" && "Review import results"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {/* Step: Select Method */}
            {step === "select" && (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="upload" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Batch (UI)
                  </TabsTrigger>
                  <TabsTrigger value="background" className="gap-2">
                    <Database className="h-4 w-4" />
                    Background Import
                  </TabsTrigger>
                </TabsList>

                {/* Upload Tab */}
                <TabsContent value="upload" className="flex-1 space-y-4 mt-0">
                  {/* Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}
                  >
                    <CloudUpload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop CVs here, or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary hover:underline font-medium"
                      >
                        browse files
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX up to 20MB each • Max {MAX_FILES.toLocaleString()} files
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* Selected Files */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {files.length} file{files.length !== 1 ? "s" : ""} selected
                          <span className="text-muted-foreground ml-2">
                            ({formatBytes(files.reduce((acc, f) => acc + f.size, 0))})
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFiles([])}
                          className="text-muted-foreground"
                        >
                          Clear all
                        </Button>
                      </div>
                      <ScrollArea className="h-48 border rounded-md">
                        <div className="p-2 space-y-1">
                          {files.slice(0, 100).map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={() => removeFile(idx)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          {files.length > 100 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              +{files.length - 100} more files
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>

                {/* Background Import Tab */}
                <TabsContent value="background" className="flex-1 space-y-4 mt-0">
                  <div className="bg-muted/30 rounded-lg p-4 border border-muted">
                    <div className="flex items-start gap-3">
                      <Database className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm">Large Dataset Import</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          For datasets with 1,000+ CVs, use this option to queue a background import.
                          An admin will process your request and notify you when complete.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataset-name">Dataset Name *</Label>
                      <Input
                        id="dataset-name"
                        placeholder="e.g., Q1 2026 Engineering Candidates"
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dataset-notes">Notes (optional)</Label>
                      <Textarea
                        id="dataset-notes"
                        placeholder="Describe the source, file locations, or any special processing requirements..."
                        value={datasetNotes}
                        onChange={(e) => setDatasetNotes(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">What happens next?</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Your request is queued for processing</li>
                        <li>Admin will configure the data source connection</li>
                        <li>CVs will be imported in batches with progress tracking</li>
                        <li>You'll be notified when the import is complete</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Step: Upload Progress */}
            {step === "upload" && (
              <div className="space-y-4 py-8">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                  <p className="text-lg font-medium">Uploading Files</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {uploadProgress.uploaded} of {uploadProgress.total} files uploaded
                  </p>
                </div>
                <Progress value={(uploadProgress.uploaded / uploadProgress.total) * 100} className="h-2" />
              </div>
            )}

            {/* Step: Processing */}
            {step === "processing" && currentBatch && (
              <div className="space-y-4">
                {/* Batch Status */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium">Processing CVs</span>
                    </div>
                    <Badge className={batchStatusConfig[currentBatch.status].color}>
                      {batchStatusConfig[currentBatch.status].label}
                    </Badge>
                  </div>

                  <Progress value={progressPercent} className="h-2" />

                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{currentBatch.total_files}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-400">
                        {currentBatch.processed_files}
                      </p>
                      <p className="text-xs text-muted-foreground">Processed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {currentBatch.success_count}
                      </p>
                      <p className="text-xs text-muted-foreground">Success</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">
                        {currentBatch.fail_count}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <ItemsTable
                  items={filteredItems}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onRetry={retryItem}
                  onView={handleViewItem}
                />
              </div>
            )}

            {/* Step: Review */}
            {step === "review" && currentBatch && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {currentBatch.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    ) : currentBatch.status === "partial" ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                    <span className="font-medium">
                      {currentBatch.status === "completed"
                        ? "Import Complete"
                        : currentBatch.status === "partial"
                        ? "Import Partially Complete"
                        : "Import Failed"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{currentBatch.total_files}</p>
                      <p className="text-xs text-muted-foreground">Total Files</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {currentBatch.success_count}
                      </p>
                      <p className="text-xs text-muted-foreground">Parsed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-400">
                        {needsReviewCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Needs Review</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">
                        {currentBatch.fail_count}
                      </p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {currentBatch.fail_count > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryFailed}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry Failed ({currentBatch.fail_count})
                      </Button>
                    )}
                    {needsReviewCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusFilter("dedupe_review")}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                        Review Duplicates ({needsReviewCount})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <ItemsTable
                  items={filteredItems}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onRetry={retryItem}
                  onView={handleViewItem}
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {step === "select" && activeTab === "upload" && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={files.length === 0 || isCreatingBatch || isUploading}
                >
                  {isCreatingBatch || isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isUploading ? "Uploading..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Start Import ({files.length})
                    </>
                  )}
                </Button>
              </>
            )}

            {step === "select" && activeTab === "background" && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitBackgroundImport}
                  disabled={!datasetName.trim() || isSubmittingBackground}
                >
                  {isSubmittingBackground ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Request Import
                    </>
                  )}
                </Button>
              </>
            )}

            {step === "upload" && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </Button>
            )}

            {step === "processing" && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </Button>
            )}

            {step === "review" && (
              <Button onClick={handleDone}>Done</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Panel Sheet */}
      <Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          {selectedItem && (
            <ItemDetailPanel
              item={selectedItem}
              onClose={() => {
                setShowDetailPanel(false);
                setSelectedItem(null);
              }}
              onResolveDedupe={handleResolveDedupe}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// Items Table Component
interface ItemsTableProps {
  items: CVImportItem[];
  statusFilter: ItemStatus | "all";
  onStatusFilterChange: (status: ItemStatus | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRetry: (itemId: string) => Promise<boolean>;
  onView: (item: CVImportItem) => void;
}

function ItemsTable({ 
  items, 
  statusFilter, 
  onStatusFilterChange, 
  searchQuery,
  onSearchChange,
  onRetry, 
  onView 
}: ItemsTableProps) {
  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or candidate name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as ItemStatus | "all")}
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="parsed">Parsed</SelectItem>
            <SelectItem value="dedupe_review">Needs Review</SelectItem>
            <SelectItem value="merged">Merged</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        {items.length} item{items.length !== 1 ? "s" : ""}
      </div>

      <ScrollArea className="h-64 border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.file_name}</p>
                      {item.extracted_data && (item.extracted_data as any).personal?.full_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {(item.extracted_data as any).personal.full_name}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("gap-1", statusConfig[item.status].color)}>
                    {statusConfig[item.status].icon}
                    {statusConfig[item.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.parse_confidence !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            item.parse_confidence >= 0.8 ? "bg-green-500" :
                            item.parse_confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${item.parse_confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(item.parse_confidence * 100)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(item.status === "parsed" || item.status === "dedupe_review") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => onView(item)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => onRetry(item.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No items to display
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

// Item Detail Panel Component
interface ItemDetailPanelProps {
  item: CVImportItem;
  onClose: () => void;
  onResolveDedupe: (action: "create_new" | "merge_into" | "link_existing", candidateId?: string) => Promise<void>;
}

function ItemDetailPanel({ item, onClose, onResolveDedupe }: ItemDetailPanelProps) {
  const [isResolving, setIsResolving] = useState(false);
  const extractedData = item.extracted_data as any;

  const handleResolve = async (action: "create_new" | "merge_into" | "link_existing", candidateId?: string) => {
    setIsResolving(true);
    await onResolveDedupe(action, candidateId);
    setIsResolving(false);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Parsed CV Details
        </SheetTitle>
        <SheetDescription>{item.file_name}</SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge className={cn("gap-1", statusConfig[item.status].color)}>
            {statusConfig[item.status].icon}
            {statusConfig[item.status].label}
          </Badge>
          {item.parse_confidence !== null && (
            <Badge variant="outline">
              {Math.round(item.parse_confidence * 100)}% confidence
            </Badge>
          )}
        </div>

        {/* Dedupe Resolution */}
        {item.status === "dedupe_review" && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">Potential Duplicate Found</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This CV may match an existing candidate. Choose how to proceed:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolve("create_new")}
                disabled={isResolving}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Create New
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolve("merge_into")}
                disabled={isResolving}
              >
                <GitMerge className="h-3.5 w-3.5 mr-1.5" />
                Merge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResolve("link_existing")}
                disabled={isResolving}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                Link Existing
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {item.status === "failed" && item.error_message && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Error</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.error_message}</p>
          </div>
        )}

        {/* Parsed Data */}
        {extractedData && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-5 pr-4">
              {/* Personal Info */}
              {extractedData.personal && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Personal Information
                  </h4>
                  <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
                    {extractedData.personal.full_name && (
                      <p><span className="text-muted-foreground">Name:</span> {extractedData.personal.full_name}</p>
                    )}
                    {extractedData.personal.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {extractedData.personal.email}
                      </p>
                    )}
                    {extractedData.personal.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {extractedData.personal.phone}
                      </p>
                    )}
                    {extractedData.personal.location && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {extractedData.personal.location}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Headline */}
              {extractedData.headline && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Current Position</h4>
                  <div className="bg-muted/50 rounded-md p-3 text-sm">
                    <p>{extractedData.headline.current_title}</p>
                    {extractedData.headline.seniority_level && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {extractedData.headline.seniority_level}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Skills */}
              {extractedData.skills && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    Skills
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedData.skills.primary_skills?.map((skill: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {extractedData.skills.secondary_skills?.map((skill: string, i: number) => (
                      <Badge key={`sec-${i}`} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {extractedData.experience?.roles && extractedData.experience.roles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Experience
                  </h4>
                  <div className="space-y-3">
                    {extractedData.experience.roles.slice(0, 3).map((role: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium">{role.title}</p>
                        <p className="text-muted-foreground text-xs">{role.company}</p>
                        {(role.start_date || role.end_date) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {role.start_date} - {role.end_date || "Present"}
                          </p>
                        )}
                        {role.summary && (
                          <p className="text-xs mt-2 line-clamp-2">{role.summary}</p>
                        )}
                      </div>
                    ))}
                    {extractedData.experience.roles.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{extractedData.experience.roles.length - 3} more positions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {extractedData.education?.items && extractedData.education.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    Education
                  </h4>
                  <div className="space-y-2">
                    {extractedData.education.items.map((edu: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-muted-foreground text-xs">{edu.institution}</p>
                        {edu.field && (
                          <p className="text-xs text-muted-foreground">{edu.field}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field Confidence */}
              {item.field_confidence && Object.keys(item.field_confidence).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Field Confidence</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(item.field_confidence as Record<string, number>).map(([field, conf]) => (
                      <div key={field} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</span>
                        <span className={cn(
                          conf >= 0.8 ? "text-green-400" :
                          conf >= 0.5 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {Math.round(conf * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  );
}
