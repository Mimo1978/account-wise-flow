import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCandidateCV } from "@/hooks/use-candidate-cv";

interface CVInlineViewerProps {
  open: boolean;
  onClose: () => void;
  storagePath: string | null | undefined;
  candidateId: string;
  candidateName: string;
}

export function CVInlineViewer({
  open,
  onClose,
  storagePath,
  candidateId,
  candidateName,
}: CVInlineViewerProps) {
  const { getSignedUrl, downloadCV, isDownloading } = useCandidateCV();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);

  const filename = storagePath
    ? storagePath.split("/").pop() || `${candidateName}_CV.pdf`
    : `${candidateName}_CV.pdf`;

  const isPDF = storagePath?.toLowerCase().endsWith(".pdf");
  const isDoc = storagePath?.toLowerCase().endsWith(".doc") || storagePath?.toLowerCase().endsWith(".docx");

  const loadDocument = useCallback(async () => {
    if (!storagePath) {
      setError("No CV available for this candidate");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = await getSignedUrl(storagePath);
      if (url) {
        setViewerUrl(url);
      } else {
        setError("Failed to load CV. Please try again.");
      }
    } catch (err) {
      console.error("[CVInlineViewer] Error loading document:", err);
      setError("An error occurred while loading the CV.");
    } finally {
      setIsLoading(false);
    }
  }, [storagePath, getSignedUrl]);

  useEffect(() => {
    if (open && storagePath) {
      loadDocument();
    } else if (!open) {
      setViewerUrl(null);
      setError(null);
      setZoom(100);
    }
  }, [open, storagePath, loadDocument]);

  const handleDownload = () => {
    if (storagePath) {
      downloadCV(candidateId, storagePath, filename);
    }
  };

  const handleOpenExternal = () => {
    if (viewerUrl) {
      window.open(viewerUrl, "_blank");
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
        isExpanded ? "p-0" : "p-4 lg:p-8"
      )}
    >
      <div
        className={cn(
          "bg-card border rounded-lg shadow-lg flex flex-col h-full",
          isExpanded ? "rounded-none" : "max-w-5xl mx-auto"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">CV Viewer</h2>
              <p className="text-xs text-muted-foreground">{candidateName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            {isPDF && viewerUrl && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleResetZoom}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading || !storagePath}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download"}
            </Button>

            {viewerUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Tab
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-[600px] w-full max-w-3xl" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Unable to Load CV</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadDocument}>
                  Try Again
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && viewerUrl && (
            <ScrollArea className="h-full">
              <div className="flex justify-center p-4" style={{ minHeight: "100%" }}>
                {isPDF ? (
                  <iframe
                    src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="border rounded-lg bg-white shadow-sm"
                    style={{
                      width: `${zoom}%`,
                      height: isExpanded ? "calc(100vh - 80px)" : "calc(100vh - 200px)",
                      maxWidth: "100%",
                      minHeight: "600px",
                    }}
                    title={`CV - ${candidateName}`}
                  />
                ) : isDoc ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Word Document</h3>
                    <p className="text-muted-foreground mb-4">
                      Word documents cannot be previewed inline. Please download the file to view it.
                    </p>
                    <Button onClick={handleDownload} disabled={isDownloading}>
                      <Download className="h-4 w-4 mr-2" />
                      Download CV
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Preview Not Available</h3>
                    <p className="text-muted-foreground mb-4">
                      This file format cannot be previewed. Please download to view.
                    </p>
                    <Button onClick={handleDownload} disabled={isDownloading}>
                      <Download className="h-4 w-4 mr-2" />
                      Download CV
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {!isLoading && !error && !storagePath && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No CV Uploaded</h3>
              <p className="text-muted-foreground">
                This candidate doesn't have a CV on file yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
