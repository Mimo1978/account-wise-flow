import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  FileText,
  Loader2,
  AlertCircle,
  FileSearch,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { TalentDocument, docKindConfig, formatFileSize } from '@/lib/talent-document-types';
import { useTalentDocuments } from '@/hooks/use-talent-documents';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CVViewerSearch, SearchMatch } from './CVViewerSearch';
import { CVViewerTextContent } from './CVViewerTextContent';

interface EnhancedCVViewerProps {
  open: boolean;
  onClose: () => void;
  document: TalentDocument | null;
  talentId: string;
  initialSearchTerm?: string;
}

type ViewMode = 'text' | 'preview';

export function EnhancedCVViewer({
  open,
  onClose,
  document,
  talentId,
  initialSearchTerm,
}: EnhancedCVViewerProps) {
  const { getSignedUrl, downloadDocument, isDownloading } = useTalentDocuments({ talentId });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  
  // Search state
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const isPDF = document?.fileType.toLowerCase() === 'pdf' ||
                document?.fileName?.toLowerCase().endsWith('.pdf');
  const isDOCX = document?.fileName?.toLowerCase().endsWith('.docx') ||
                 document?.fileName?.toLowerCase().endsWith('.doc');
  const hasExtractedText = document?.parseStatus === 'parsed' && document?.parsedText;

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
      console.error('[EnhancedCVViewer] Error loading document:', err);
      setError('An error occurred while loading the document.');
    } finally {
      setIsLoadingUrl(false);
    }
  }, [document, getSignedUrl]);

  useEffect(() => {
    if (open && document) {
      loadDocument();
      // Default to text view if we have extracted text, otherwise preview
      setViewMode('preview');
    } else {
      setPdfUrl(null);
      setError(null);
      setZoom(100);
      setMatches([]);
      setCurrentMatchIndex(-1);
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

  const handleMatchesChange = useCallback((newMatches: SearchMatch[], newIndex: number) => {
    setMatches(newMatches);
    setCurrentMatchIndex(newIndex);
  }, []);

  if (!document) return null;

  const typeConfig = docKindConfig[document.docKind];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 flex flex-col gap-0">
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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  {hasExtractedText && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">
                        <FileSearch className="h-3 w-3 mr-1" />
                        Searchable
                      </Badge>
                    </>
                  )}
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

        {/* View Mode Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
            <TabsList className="h-8">
              <TabsTrigger value="text" className="text-xs px-3" disabled={!hasExtractedText}>
                <FileSearch className="h-3.5 w-3.5 mr-1.5" />
                Text + Search
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-3">
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Zoom controls for preview mode */}
            {viewMode === 'preview' && pdfUrl && (
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom Out</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs w-10 text-center text-muted-foreground">{zoom}%</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zoom In</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetZoom}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset Zoom</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoadingUrl ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Loading document...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
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
            ) : (
              <>
                {/* Text View with Search */}
                <TabsContent value="text" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
                  {hasExtractedText ? (
                    <>
                      <CVViewerSearch
                        text={document.parsedText || ''}
                        onMatchesChange={handleMatchesChange}
                      />
                      <CVViewerTextContent
                        text={document.parsedText || ''}
                        matches={matches}
                        currentMatchIndex={currentMatchIndex}
                        className="flex-1 bg-card"
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center max-w-md px-6">
                        <FileSearch className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium mb-2">Text Not Available</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          {document.parseStatus === 'pending'
                            ? 'Text extraction is in progress. Please check back in a moment.'
                            : document.parseStatus === 'failed'
                            ? 'Text extraction failed for this document. You can still view the original file.'
                            : 'This document does not have extracted text.'}
                        </p>
                        {isPDF && (
                          <Button variant="outline" size="sm" onClick={() => setViewMode('preview')}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Original PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Preview */}
                <TabsContent value="preview" className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden">
                  {isPDF && pdfUrl ? (
                    <div className="h-full overflow-auto bg-muted/20">
                      <div
                        className="flex justify-center p-4"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                      >
                        <iframe
                          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                          className="w-full max-w-4xl bg-white shadow-lg rounded-lg"
                          style={{ height: '1400px', border: 'none' }}
                          title="CV Preview"
                        />
                      </div>
                    </div>
                  ) : isDOCX && hasExtractedText ? (
                    <div className="h-full overflow-auto bg-white p-8">
                      <div
                        className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg p-12"
                        style={{
                          fontFamily: "'Times New Roman', Georgia, serif",
                          fontSize: '11pt',
                          lineHeight: '1.6',
                          color: '#1a1a1a',
                          minHeight: '900px',
                        }}
                      >
                        {document.parsedText?.split('\n').map((line, i) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={i} style={{ height: '8px' }} />;

                          const isHeader =
                            trimmed === trimmed.toUpperCase() &&
                            trimmed.length > 3 &&
                            trimmed.length < 60 &&
                            !/^[0-9]/.test(trimmed);
                          const isSubheader = trimmed.endsWith(':') && trimmed.length < 80;
                          const isBullet =
                            trimmed.startsWith('•') ||
                            trimmed.startsWith('-') ||
                            trimmed.startsWith('*');

                          if (isHeader) {
                            return (
                              <h2
                                key={i}
                                style={{
                                  fontSize: '13pt',
                                  fontWeight: 'bold',
                                  marginTop: '20px',
                                  marginBottom: '6px',
                                  borderBottom: '1px solid #333',
                                  paddingBottom: '3px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {trimmed}
                              </h2>
                            );
                          }
                          if (isSubheader) {
                            return (
                              <h3
                                key={i}
                                style={{
                                  fontSize: '11pt',
                                  fontWeight: 'bold',
                                  marginTop: '10px',
                                  marginBottom: '4px',
                                }}
                              >
                                {trimmed}
                              </h3>
                            );
                          }
                          if (isBullet) {
                            return (
                              <p key={i} style={{ paddingLeft: '20px', marginBottom: '3px' }}>
                                {trimmed}
                              </p>
                            );
                          }
                          return (
                            <p key={i} style={{ marginBottom: '4px' }}>
                              {trimmed}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  ) : pdfUrl ? (
                    <div className="h-full overflow-hidden">
                      <iframe
                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
                        className="w-full h-full"
                        style={{ border: 'none', minHeight: '800px' }}
                        title="CV Preview"
                      />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center p-6">
                      <div className="text-center max-w-md">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm font-medium mb-2">Preview unavailable</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Download the file to view it in its original format.
                        </p>
                        <Button variant="outline" onClick={handleDownload}>
                          <Download className="h-4 w-4 mr-2" /> Download File
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
