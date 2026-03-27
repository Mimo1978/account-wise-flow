import { useState, useEffect, useCallback, useRef } from "react";
import { useCandidateCV } from "@/hooks/use-candidate-cv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Upload,
  Loader2,
  FileUp,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineCVViewerProps {
  candidateId: string;
  candidateName: string;
  cvStoragePath?: string;
  canEdit: boolean;
  onExportClick: () => void;
  onUploadComplete?: () => void;
}

function getFileNameFromPath(path: string): string {
  const parts = path.split("/");
  const raw = parts[parts.length - 1] || "CV";
  // Strip the timestamp prefix like "1234567890_"
  return raw.replace(/^\d+_/, "");
}

function isPdf(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export function InlineCVViewer({
  candidateId,
  candidateName,
  cvStoragePath,
  canEdit,
  onExportClick,
  onUploadComplete,
}: InlineCVViewerProps) {
  const { getSignedUrl, downloadCV, uploadCV, isUploading, isDownloading, validateFile } = useCandidateCV();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cvStoragePath) return;
    setIsLoadingUrl(true);
    getSignedUrl(cvStoragePath).then((url) => {
      setSignedUrl(url);
      setIsLoadingUrl(false);
    });
  }, [cvStoragePath, getSignedUrl]);

  const handleDownload = () => {
    if (!cvStoragePath) return;
    const filename = getFileNameFromPath(cvStoragePath);
    downloadCV(candidateId, cvStoragePath, filename);
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      const validation = validateFile(file);
      if (!validation.valid) return;
      const success = await uploadCV(candidateId, file);
      if (success) onUploadComplete?.();
    },
    [candidateId, uploadCV, validateFile, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  // No CV uploaded — show upload zone
  if (!cvStoragePath) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        )}
      >
        <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          No CV uploaded
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Drag and drop a PDF, DOC, or DOCX file here
        </p>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1.5" /> Choose File</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleInputChange}
            />
          </>
        )}
      </div>
    );
  }

  const fileName = getFileNameFromPath(cvStoragePath);
  const isPdfFile = isPdf(cvStoragePath);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-mono text-xs">
            <FileText className="h-3 w-3" />
            {fileName}
          </Badge>
          {isPdfFile && (
            <Badge variant="outline" className="text-xs text-muted-foreground">PDF</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Download
          </Button>
          {signedUrl && isPdfFile && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              asChild
            >
              <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={onExportClick}
          >
            <FileText className="h-3 w-3" />
            Export Client CV
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Replace
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleInputChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Viewer */}
      {isLoadingUrl ? (
        <div className="flex items-center justify-center h-[400px] border border-border rounded-lg bg-muted/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isPdfFile && signedUrl ? (
        <iframe
          src={signedUrl}
          className="w-full border border-border rounded-lg bg-white"
          style={{ height: "800px" }}
          title={`CV — ${candidateName}`}
        />
      ) : (
        /* DOCX or other non-PDF — show download prompt */
        <div className="border border-border rounded-lg p-8 text-center bg-muted/20">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">{fileName}</p>
          <p className="text-xs text-muted-foreground mb-4">
            This file type can't be previewed inline. Download to view.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Downloading...</>
            ) : (
              <><Download className="h-3.5 w-3.5 mr-1.5" /> Download {fileName}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
