import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { useCandidateCV } from "@/hooks/use-candidate-cv";
import { useTalentDocuments } from "@/hooks/use-talent-documents";

interface CVViewerPanelProps {
  candidateId: string;
  candidateName: string;
  cvStoragePath?: string;
  rawCvText?: string;
  canEdit: boolean;
  onExportClick: () => void;
  onUploadComplete?: () => void;
}

function getFileNameFromPath(path: string): string {
  const parts = path.split("/");
  const raw = parts[parts.length - 1] || "CV";
  return raw.replace(/^\d+_/, "");
}

export function CVViewerPanel({
  candidateId,
  candidateName,
  cvStoragePath,
  rawCvText,
  canEdit,
  onExportClick,
  onUploadComplete,
}: CVViewerPanelProps) {
  const { getSignedUrl, downloadCV, uploadCV, isUploading, isDownloading, validateFile } = useCandidateCV();
  const { documents, refetch: refetchDocs } = useTalentDocuments({ talentId: candidateId });
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find primary CV document
  const primaryDoc = documents.find(d => d.docKind === 'cv') || documents[0] || null;
  const isPdfReady = primaryDoc?.pdfConversionStatus === 'done' || primaryDoc?.pdfConversionStatus === 'not_needed';
  const isConverting = primaryDoc?.pdfConversionStatus === 'converting' || primaryDoc?.pdfConversionStatus === 'pending';

  // Get signed URL for the original file (for download)
  useEffect(() => {
    if (!cvStoragePath) return;
    setIsLoadingUrl(true);
    getSignedUrl(cvStoragePath).then((url) => {
      setSignedUrl(url);
      setIsLoadingUrl(false);
    });
  }, [cvStoragePath, getSignedUrl]);

  // Get signed URL for the PDF preview
  useEffect(() => {
    const pdfPath = primaryDoc?.pdfStoragePath;
    if (!pdfPath || !isPdfReady) {
      setPdfSignedUrl(null);
      return;
    }
    supabase.storage
      .from("candidate_cvs")
      .createSignedUrl(pdfPath, 3600)
      .then(({ data }) => setPdfSignedUrl(data?.signedUrl || null));
  }, [primaryDoc?.pdfStoragePath, isPdfReady]);

  // Poll while converting
  useEffect(() => {
    if (!isConverting) return;
    const interval = setInterval(() => {
      refetchDocs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isConverting, refetchDocs]);

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

  // No CV — upload zone
  if (!cvStoragePath) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">CV Viewer</span>
        </div>
        <div
          className="flex-1 flex items-center justify-center p-8"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors w-full max-w-md",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <FileUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-base font-medium text-foreground mb-1">
              No CV on file
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              Drag and drop a PDF or DOCX file here, or click to upload
            </p>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Choose File</>
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
        </div>
      </div>
    );
  }

  const fileName = getFileNameFromPath(cvStoragePath);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-mono text-xs">
            <FileText className="h-3 w-3" />
            {fileName}
          </Badge>
          {isConverting && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Converting…
            </Badge>
          )}
          {isPdfReady && (
            <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">
              PDF
            </Badge>
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
          {pdfSignedUrl && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
              <a href={pdfSignedUrl} target="_blank" rel="noopener noreferrer">
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

      {/* CV Content */}
      <div className="flex-1 overflow-auto bg-muted/10">
        {isLoadingUrl ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPdfReady && pdfSignedUrl ? (
          <iframe
            src={pdfSignedUrl}
            className="w-full h-full border-0"
            style={{ minHeight: "900px" }}
            title={`CV — ${candidateName}`}
          />
        ) : isConverting ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">
                Converting to PDF preview…
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This usually takes about 10 seconds
              </p>
            </div>
          </div>
        ) : rawCvText ? (
          /* Fallback: DOCX with extracted text */
          <div className="p-6 max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {rawCvText}
              </div>
            </div>
          </div>
        ) : (
          /* No preview available — download prompt */
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
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
          </div>
        )}
      </div>
    </div>
  );
}
