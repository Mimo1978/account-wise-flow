import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCVBatchImport } from "@/hooks/use-cv-batch-import";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CMOrbital, CMPulse } from "@/components/ui/CMLoader";
import { cn } from "@/lib/utils";
import {
  Upload, CheckCircle2, XCircle, AlertTriangle,
  Users, FileText, ChevronRight, RotateCcw
} from "lucide-react";

export default function BulkCVUpload() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [phase, setPhase] = useState<"idle"|"uploading"|"processing"|"done">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [batchId, setBatchId] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);

  const {
    createBatch,
    uploadFiles,
    completeUpload,
    isUploading,
    uploadProgress: hookProgress,
  } = useCVBatchImport();

  const handleFiles = useCallback(async (files: File[]) => {
    if (!currentWorkspace?.id || files.length === 0) return;

    const validFiles = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf","doc","docx"].includes(ext || "") && f.size > 15000 && f.size < 15000000;
    });

    if (validFiles.length === 0) {
      setError("No valid CV files found. Files must be PDF or Word, between 15KB and 15MB.");
      return;
    }

    setTotalFiles(validFiles.length);
    setPhase("uploading");
    setError(null);
    setUploadedCount(0);
    setUploadProgress(0);

    try {
      const result = await createBatch(validFiles.length);
      if (!result) throw new Error("Failed to create batch");
      setBatchId(result.batch.id);

      const uploadPath = result.uploadPath || `${currentWorkspace.id}/${result.batch.id}`;
      const success = await uploadFiles(validFiles, result.batch.id, uploadPath, 5);

      if (success) {
        setUploadedCount(validFiles.length);
        setUploadProgress(100);
        setPhase("processing");
        await completeUpload(result.batch.id);
      } else {
        setPhase("processing");
        await completeUpload(result.batch.id);
      }

    } catch (e: any) {
      setError(e.message || "Upload failed. Please try again.");
      setPhase("idle");
    }
  }, [currentWorkspace?.id, createBatch, uploadFiles, completeUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
    if (inputRef.current) inputRef.current.value = "";
  }, [handleFiles]);

  const reset = () => {
    setPhase("idle");
    setTotalFiles(0);
    setUploadedCount(0);
    setUploadProgress(0);
    setBatchId(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Bulk CV Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import thousands of CVs at once. AI reads each file and creates candidate records automatically.
          </p>
        </div>

        {/* IDLE — drop zone */}
        {phase === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all",
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"
            )}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-base font-medium text-foreground">Drop your CV folder here</p>
            <p className="text-sm text-muted-foreground mt-1">Select all files — PDF and Word supported</p>
            <p className="text-xs text-muted-foreground/60 mt-3">No file limit · Files under 15KB or over 15MB are skipped automatically</p>
            <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx" className="hidden" onChange={handleSelect} />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="ghost" size="sm" onClick={reset}>Try again</Button>
          </div>
        )}

        {/* UPLOADING */}
        {phase === "uploading" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <CMPulse size="lg" />
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-sm text-muted-foreground mb-2">
                    <span>{hookProgress.uploaded} of {hookProgress.total || totalFiles} uploaded</span>
                    <span>{hookProgress.total > 0 ? Math.round((hookProgress.uploaded / hookProgress.total) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Do not close this tab while uploading
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PROCESSING */}
        {phase === "processing" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-6">
                <CMOrbital size={80} messages={["Scanning profiles...", "Extracting skills...", "Matching companies...", "Building records..."]} />
                <div className="text-center">
                  <p className="text-base font-medium text-foreground">
                    Processing {totalFiles.toLocaleString()} CVs
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This runs in the background — you can close this tab and come back later.
                    Check progress in Import History.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="default" onClick={() => navigate("/talent")} className="gap-2">
                    <Users className="w-4 h-4" /> Go to Talent
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/imports")} className="gap-2">
                    <ChevronRight className="w-4 h-4" /> View Import History
                  </Button>
                </div>

                <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Import more CVs
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info cards */}
        {phase === "idle" && (
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { icon: FileText, title: "AI reads every CV", desc: "Extracts name, email, phone, skills, experience, company history" },
              { icon: Users, title: "Instant candidate records", desc: "Each CV becomes a searchable candidate in your Talent database" },
              { icon: CheckCircle2, title: "Duplicates handled", desc: "Same CV submitted twice is detected automatically by checksum" },
            ].map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <c.icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-sm font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
