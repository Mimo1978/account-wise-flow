import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { TalentDocument, docKindConfig, formatFileSize } from '@/lib/talent-document-types';
import { useTalentDocuments } from '@/hooks/use-talent-documents';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TalentDocumentViewerProps {
  open: boolean;
  onClose: () => void;
  document: TalentDocument | null;
  talentId: string;
}

export function TalentDocumentViewer({
  open,
  onClose,
  document,
  talentId,
}: TalentDocumentViewerProps) {
  const { getSignedUrl, downloadDocument, isDownloading } = useTalentDocuments({ talentId });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const loadDocument = useCallback(async () => {
    if (!document) return;

    setIsLoadingUrl(true);
    setError(null);

    try {
      const url = await getSignedUrl(document.filePath);
      if (url) {
        setPdfUrl(url);
      } else {
        setError('Failed to load document. Please try again.');
      }
    } catch (err) {
      console.error('[TalentDocumentViewer] Error loading document:', err);
      setError('An error occurred while loading the document.');
    } finally {
      setIsLoadingUrl(false);
    }
  }, [document, getSignedUrl]);

  useEffect(() => {
    if (open && document) {
      loadDocument();
    } else {
      setPdfUrl(null);
      setError(null);
      setZoom(100);
      setCurrentPage(1);
    }
  }, [open, document, loadDocument]);

  const handleDownload = () => {
    if (document) {
      downloadDocument(document);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  if (!document) return null;

  const typeConfig = docKindConfig[document.docKind];
  const isPDF = document.fileType.toLowerCase() === 'pdf';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  {document.fileName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className={cn('text-xs', typeConfig.color)}>
                    {typeConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(document.fileSize)}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    Uploaded {format(new Date(document.uploadedAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar for PDF */}
        {isPDF && pdfUrl && (
          <div className="px-4 py-2 border-b border-border flex items-center justify-center gap-2 flex-shrink-0 bg-muted/30">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoadingUrl ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                <p className="text-sm font-medium mb-2">Failed to Load Document</p>
                <p className="text-xs text-muted-foreground mb-4">{error}</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={loadDocument}>
                    Retry
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    Download Instead
                  </Button>
                </div>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="h-full overflow-auto bg-muted/20">
              {isPDF ? (
                <div
                  className="flex justify-center p-4"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                >
                  <iframe
                    src={`${pdfUrl}#toolbar=0&navpanes=0`}
                    className="w-full max-w-4xl bg-white shadow-lg rounded-lg"
                    style={{ height: '1200px' }}
                    title="Document Viewer"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm font-medium mb-2">Preview not available</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {document.fileType} files cannot be previewed in the browser.
                      Please download the file to view it.
                    </p>
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No document to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
