import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { validateBatch } from "@/lib/cv-file-validator";
import { cn } from "@/lib/utils";
import {
  Upload, CheckCircle2, XCircle, Loader2,
  FileText, AlertTriangle, Users, ChevronRight
} from "lucide-react";

interface FileResult {
  name: string;
  status: "waiting" | "processing" | "done" | "error" | "skipped";
  candidateName?: string;
  candidateId?: string;
  error?: string;
}

const BATCH_SIZE = 5; // Process 5 at a time to avoid rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 second pause between batches

export default function BulkCVUpload() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const abortRef = useRef(false);

  const done = files.filter(f => f.status === "done").length;
  const errors = files.filter(f => f.status === "error").length;
  const skipped = files.filter(f => f.status === "skipped").length;
  const processing = files.filter(f => f.status === "processing").length;
  const waiting = files.filter(f => f.status === "waiting").length;
  const finished = files.length > 0 && waiting === 0 && processing === 0 && isRunning === false;

  const processFile = async (file: File, index: number): Promise<void> => {
    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, status: "processing" } : f
    ));

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
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
        setFiles(prev => prev.map((f, i) =>
          i === index ? {
            ...f,
            status: "done",
            candidateName: data.candidate_name,
            candidateId: data.candidate_id,
          } : f
        ));
      } else {
        setFiles(prev => prev.map((f, i) =>
          i === index ? {
            ...f,
            status: "error",
            error: data?.error || "Could not parse CV",
          } : f
        ));
      }
    } catch (e: any) {
      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, status: "error", error: e.message } : f
      ));
    }
  };

  const startProcessing = useCallback(async (fileList: FileResult[], rawFiles: File[]) => {
    if (!currentWorkspace?.id) return;
    abortRef.current = false;
    setIsRunning(true);

    const batches = Math.ceil(rawFiles.length / BATCH_SIZE);
    setTotalBatches(batches);

    for (let b = 0; b < batches; b++) {
      if (abortRef.current) break;
      setCurrentBatch(b + 1);

      const start = b * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, rawFiles.length);
      const batchFiles = rawFiles.slice(start, end);
      const batchIndices = Array.from({ length: end - start }, (_, i) => start + i);

      await Promise.all(
        batchFiles.map((file, i) => processFile(file, batchIndices[i]))
      );

      if (b < batches - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }

    setIsRunning(false);
  }, [currentWorkspace?.id]);

  const handleFiles = useCallback(async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return;

    const { valid, rejected } = await validateBatch(rawFiles);

    const fileResults: FileResult[] = [
      ...valid.map(f => ({ name: f.name, status: "waiting" as const })),
      ...rejected.map(r => ({ name: r.file.name, status: "skipped" as const, error: r.error })),
    ];

    setFiles(fileResults);
    setCurrentBatch(0);
    setTotalBatches(0);

    if (valid.length > 0) {
      await startProcessing(fileResults, valid);
    }
  }, [startProcessing]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) handleFiles(dropped);
  }, [handleFiles]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) handleFiles(selected);
    if (inputRef.current) inputRef.current.value = "";
  }, [handleFiles]);

  const progress = files.length > 0
    ? Math.round(((done + errors + skipped) / files.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Bulk CV Import
          </h1>
          <p className="text-muted-foreground text-base">
            Drop your entire CV folder here. AI reads each file and creates candidate records automatically.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx"
          onChange={handleSelect}
          className="hidden"
        />

        {/* Drop zone */}
        {files.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">
              Drop your CV folder here
            </h3>
            <p className="text-muted-foreground mb-4">
              Select all files from your CVs folder — PDF and Word supported
            </p>
            <p className="text-sm text-muted-foreground/70">
              No limit on number of files · Processed 5 at a time · AI extracts name, email, phone, skills
            </p>
            <Button variant="outline" className="mt-6">
              <Upload className="h-4 w-4 mr-2" />
              Select Files
            </Button>
          </div>
        )}

        {/* Progress bar */}
        {files.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">

                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {isRunning
                        ? `Processing batch ${currentBatch} of ${totalBatches}...`
                        : finished
                          ? "Import complete"
                          : "Ready"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {done} imported · {errors} failed · {skipped} skipped · {waiting} waiting
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">{progress}%</div>
                    <div className="text-sm text-muted-foreground">{done + errors + skipped} / {files.length}</div>
                  </div>
                </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4 pt-2">
                {[
                  { label: "Imported", value: done, color: "text-green-600" },
                  { label: "Processing", value: processing, color: "text-blue-500" },
                  { label: "Failed", value: errors, color: "text-red-500" },
                  { label: "Waiting", value: waiting, color: "text-muted-foreground" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

            </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons when done */}
        {finished && (
          <div className="flex gap-3">
            <Button onClick={() => navigate("/talent")} className="gap-2">
              <Users className="h-4 w-4" />
              View {done} candidates in Talent
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => {
              setFiles([]);
              setCurrentBatch(0);
              setTotalBatches(0);
            }}>
              Import more CVs
            </Button>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {f.status === "done" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                  {f.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                  {f.status === "skipped" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {f.status === "processing" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                  {f.status === "waiting" && <FileText className="h-5 w-5 text-muted-foreground" />}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {f.status === "done" && f.candidateName
                      ? <>{f.candidateName} ← {f.name}</>
                      : f.name
                    }
                  </div>
                  {f.error && (
                    <div className="text-xs text-red-500 truncate">{f.error}</div>
                  )}
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    f.status === "done" && "bg-green-500/10 text-green-600",
                    f.status === "error" && "bg-red-500/10 text-red-500",
                    f.status === "skipped" && "bg-amber-500/10 text-amber-600",
                    f.status === "processing" && "bg-blue-500/10 text-blue-500",
                    f.status === "waiting" && "bg-muted text-muted-foreground"
                  )}>
                    {f.status === "done" ? "Imported" :
                     f.status === "error" ? "Failed" :
                     f.status === "skipped" ? "Skipped" :
                     f.status === "processing" ? "Reading..." :
                     "Waiting"}
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
