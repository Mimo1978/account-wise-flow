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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCVBatchImport, CVImportItem, ItemStatus, BatchStatus } from "@/hooks/use-cv-batch-import";

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

type Step = "upload" | "processing" | "review";

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
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
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
    
    setStep("upload");
    setFiles([]);
    setStatusFilter("all");
    setCurrentPage(1);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderUp className="h-5 w-5 text-primary" />
            Batch CV Import
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload multiple CVs (PDF, DOC, DOCX) for bulk processing"}
            {step === "processing" && "Processing your CVs..."}
            {step === "review" && "Review import results"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === "upload" && (
            <div className="space-y-4">
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
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
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

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>
                      {uploadProgress.uploaded} / {uploadProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={(uploadProgress.uploaded / uploadProgress.total) * 100}
                  />
                </div>
              )}
            </div>
          )}

          {/* Processing Step */}
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

                <Progress value={progressPercent} />

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
                items={items}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onRetry={retryItem}
              />
            </div>
          )}

          {/* Review Step */}
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

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-400">
                      {currentBatch.success_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Successfully Parsed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">
                      {currentBatch.fail_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-400">
                      {items.filter((i) => i.status === "dedupe_review").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Needs Review</p>
                  </div>
                </div>

                {currentBatch.fail_count > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryFailed}
                    className="mt-3"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry Failed ({currentBatch.fail_count})
                  </Button>
                )}
              </div>

              {/* Items Table */}
              <ItemsTable
                items={items}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onRetry={retryItem}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === "upload" && (
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

          {step === "processing" && (
            <Button variant="outline" disabled>
              Processing...
            </Button>
          )}

          {step === "review" && (
            <Button onClick={handleDone}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Items Table Component
interface ItemsTableProps {
  items: CVImportItem[];
  statusFilter: ItemStatus | "all";
  onStatusFilterChange: (status: ItemStatus | "all") => void;
  onRetry: (itemId: string) => Promise<boolean>;
}

function ItemsTable({ items, statusFilter, onStatusFilterChange, onRetry }: ItemsTableProps) {
  const filteredItems = statusFilter === "all"
    ? items
    : items.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredItems.length} items
        </span>
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as ItemStatus | "all")}
        >
          <SelectTrigger className="w-40 h-8">
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

      <ScrollArea className="h-64 border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{item.file_name}</span>
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
                    <span className="text-sm">
                      {Math.round(item.parse_confidence * 100)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRetry(item.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredItems.length === 0 && (
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