import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { validateBatch } from "@/lib/cv-file-validator";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;

interface FileStatus {
  fileName: string;
  status: "pending" | "parsing" | "done" | "error";
  candidateName?: string;
  candidateId?: string;
  error?: string;
}

interface FastCVUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function FastCVUpload({ open, onOpenChange, onComplete }: FastCVUploadProps) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [rejected, setRejected] = useState<Array<{ file: File; error: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const allDone = files.length > 0 && files.every((f) => f.status === "done" || f.status === "error");

  const processFile = useCallback(
    async (file: File, index: number) => {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "parsing" } : f))
      );

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke("fast-cv-import", {
          body: {
            base64,
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            tenantId: currentWorkspace?.id,
          },
        });

        if (error) throw new Error(error.message);

        if (data?.ok) {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index
                ? {
                    ...f,
                    status: "done",
                    candidateName: data.candidate_name,
                    candidateId: data.candidate_id,
                  }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index
                ? { ...f, status: "error", error: data?.error || "Parse failed" }
                : f
            )
          );
        }
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "error", error: err.message || "Upload failed" }
              : f
          )
        );
      }
    },
    [currentWorkspace?.id]
  );

  const handleFiles = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length > MAX_FILES) {
        toast.warning(`Maximum ${MAX_FILES} files at once. Only the first ${MAX_FILES} will be processed.`);
        selectedFiles = selectedFiles.slice(0, MAX_FILES);
      }

      const { valid, rejected: rej } = await validateBatch(selectedFiles);
      setRejected(rej);

      if (valid.length === 0) {
        toast.error("No valid CV files found");
        return;
      }

      const statuses: FileStatus[] = valid.map((f) => ({
        fileName: f.name,
        status: "pending",
      }));
      setFiles(statuses);
      setIsProcessing(true);

      // Process all files in parallel
      await Promise.all(valid.map((file, i) => processFile(file, i)));

      setIsProcessing(false);
    },
    [processFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []);
      if (selected.length > 0) handleFiles(selected);
      e.target.value = "";
    },
    [handleFiles]
  );

  const handleClose = () => {
    if (allDone && doneCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["candidates"], exact: false });
      onComplete?.();
    }
    setFiles([]);
    setRejected([]);
    onOpenChange(false);
  };

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: ["candidates"], exact: false });
    onComplete?.();
    setFiles([]);
    setRejected([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CVs
          </DialogTitle>
        </DialogHeader>

        {files.length === 0 ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop CV files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX — up to {MAX_FILES} files, 10MB each
                </p>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={onFileInput}
            />

            {/* Show rejected files from validation */}
            {rejected.length > 0 && (
              <div className="space-y-1 mt-2">
                {rejected.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{r.file.name}</span>
                    <span className="text-xs text-muted-foreground">— {r.error}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Progress summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {allDone
                  ? `${doneCount} candidate${doneCount !== 1 ? "s" : ""} added`
                  : `Processing ${files.length} file${files.length !== 1 ? "s" : ""}…`}
              </span>
              {isProcessing && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {doneCount + errorCount} / {files.length}
                </Badge>
              )}
              {allDone && doneCount > 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>

            {/* File list */}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                      f.status === "done" && "border-green-500/30 bg-green-500/5",
                      f.status === "error" && "border-destructive/30 bg-destructive/5",
                      f.status === "parsing" && "border-primary/30 bg-primary/5"
                    )}
                  >
                    {f.status === "pending" && (
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    {f.status === "parsing" && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                    )}
                    {f.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                    {f.status === "error" && (
                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      {f.status === "done" ? (
                        <span className="font-medium">{f.candidateName}</span>
                      ) : (
                        <span className="truncate block">{f.fileName}</span>
                      )}
                      {f.status === "parsing" && (
                        <span className="text-xs text-muted-foreground">Parsing…</span>
                      )}
                      {f.status === "done" && (
                        <span className="text-xs text-muted-foreground">
                          Added to Talent Database
                        </span>
                      )}
                      {f.status === "error" && (
                        <span className="text-xs text-destructive">{f.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            {allDone && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Close
                </Button>
                <Button size="sm" onClick={handleDone}>
                  View in Talent Database
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
