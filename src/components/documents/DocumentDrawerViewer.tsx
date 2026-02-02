import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  CaseSensitive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/use-documents";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Document, EntityType, documentTypeConfig } from "@/lib/document-types";

interface DocumentDrawerViewerProps {
  open: boolean;
  onClose: () => void;
  document: Document | null;
  entityType: EntityType;
  entityId: string;
  entityName: string;
}

// Memoized highlight component for text search
const HighlightedText = memo(({
  text,
  searchTerm,
  matchCase,
  currentMatchIndex,
  allMatchIndices,
}: {
  text: string;
  searchTerm: string;
  matchCase: boolean;
  currentMatchIndex?: number;
  allMatchIndices?: number[];
}) => {
  if (!searchTerm.trim()) {
    return <>{text}</>;
  }

  const flags = matchCase ? "g" : "gi";
  const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedSearch})`, flags);
  const parts = text.split(regex);

  let matchCounter = -1;

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = matchCase
          ? part === searchTerm
          : part.toLowerCase() === searchTerm.toLowerCase();

        if (isMatch) {
          matchCounter++;
          const isCurrentMatch =
            currentMatchIndex !== undefined &&
            allMatchIndices &&
            matchCounter === currentMatchIndex;

          return (
            <mark
              key={index}
              className={cn(
                "px-0.5 rounded-sm transition-colors",
                isCurrentMatch
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground"
              )}
              data-match-index={matchCounter}
            >
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
});

HighlightedText.displayName = "HighlightedText";

export function DocumentDrawerViewer({
  open,
  onClose,
  document: doc,
  entityType,
  entityId,
  entityName,
}: DocumentDrawerViewerProps) {
  const { getSignedUrl, downloadDocument, isDownloading } = useDocuments({
    entityType,
    entityId,
  });

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  // Page navigation (for PDF)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const filename = doc?.name || "Document";
  const isPDF = doc?.storagePath?.toLowerCase().endsWith(".pdf");
  const isDoc =
    doc?.storagePath?.toLowerCase().endsWith(".doc") ||
    doc?.storagePath?.toLowerCase().endsWith(".docx");

  // Generate text content for DOC/DOCX or when rawText is available
  const textContent = useMemo(() => {
    if (doc?.rawText) {
      return doc.rawText;
    }
    if (isDoc) {
      return `Document Preview Not Available\n\nThis Word document requires download to view the full content.\n\nDocument: ${filename}`;
    }
    return null;
  }, [doc?.rawText, isDoc, filename]);

  // Calculate search matches
  const matches = useMemo(() => {
    if (!searchTerm.trim() || !textContent) return [];

    const flags = matchCase ? "g" : "gi";
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedSearch, flags);
    const matchList: number[] = [];
    let match;

    while ((match = regex.exec(textContent)) !== null) {
      matchList.push(match.index);
    }

    return matchList;
  }, [textContent, searchTerm, matchCase]);

  const loadDocument = useCallback(async () => {
    if (!doc?.storagePath) {
      setError("No document available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = await getSignedUrl(doc.storagePath);
      if (url) {
        setViewerUrl(url);
      } else {
        setError("Failed to load document. Please try again.");
      }
    } catch (err) {
      console.error("[DocumentDrawerViewer] Error loading document:", err);
      setError("An error occurred while loading the document.");
    } finally {
      setIsLoading(false);
    }
  }, [doc?.storagePath, getSignedUrl]);

  useEffect(() => {
    if (open && doc?.storagePath) {
      loadDocument();
    } else if (!open) {
      setViewerUrl(null);
      setError(null);
      setZoom(100);
      setSearchTerm("");
      setCurrentMatchIndex(0);
      setCurrentPage(1);
    }
  }, [open, doc?.storagePath, loadDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      if (e.key === "Escape") {
        if (searchFocused && searchTerm) {
          setSearchTerm("");
          setSearchFocused(false);
        } else {
          onClose();
        }
      }
      if (e.key === "Enter" && searchFocused && matches.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateMatch("prev");
        } else {
          navigateMatch("next");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, searchFocused, searchTerm, matches.length, onClose]);

  const handleDownload = () => {
    if (doc) {
      downloadDocument(doc);
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

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentMatchIndex(0);
  };

  const navigateMatch = (direction: "next" | "prev") => {
    if (matches.length === 0) return;

    if (direction === "next") {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    } else {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  const handlePageChange = (direction: "next" | "prev") => {
    if (direction === "next" && currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    } else if (direction === "prev" && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const showTextViewer = isDoc || (doc?.rawText && !isPDF);
  const typeConfig = doc ? documentTypeConfig[doc.documentType] : null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        className={cn(
          "p-0 flex flex-col gap-0",
          isFullscreen ? "w-full sm:max-w-full" : "w-full sm:max-w-3xl lg:max-w-4xl"
        )}
        side="right"
      >
        {/* Header */}
        <SheetHeader className="p-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold flex items-center gap-2">
                  {filename}
                  {typeConfig && (
                    <Badge variant="secondary" className="text-xs">
                      {typeConfig.label}
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-xs text-muted-foreground truncate">{entityName}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading || !doc}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? "..." : "Download"}
              </Button>

              {viewerUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleOpenExternal}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in new tab</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Search & Controls Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30 flex-shrink-0">
          {/* Search */}
          <div className="flex items-center gap-1 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search... (Ctrl+F)"
                className="pl-8 pr-20 h-8 text-sm"
              />
              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : "0/0"}
                  </span>
                </div>
              )}
            </div>

            {searchTerm && matches.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigateMatch("prev")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous (Shift+Enter)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigateMatch("next")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next (Enter)</TooltipContent>
                </Tooltip>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={matchCase ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setMatchCase(!matchCase);
                    setCurrentMatchIndex(0);
                  }}
                >
                  <CaseSensitive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Match case</TooltipContent>
            </Tooltip>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>

            <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset zoom</TooltipContent>
            </Tooltip>
          </div>

          {/* Page Navigation (for PDF) */}
          {isPDF && totalPages > 1 && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange("prev")}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous page</TooltipContent>
                </Tooltip>

                <span className="text-xs text-muted-foreground w-16 text-center">
                  {currentPage} / {totalPages}
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange("next")}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next page</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="space-y-4 text-center">
                <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={loadDocument}>
                Try Again
              </Button>
            </div>
          ) : showTextViewer && textContent ? (
            <ScrollArea className="h-full">
              <div
                className="p-6 font-mono text-sm whitespace-pre-wrap leading-relaxed"
                style={{ fontSize: `${zoom}%` }}
              >
                <HighlightedText
                  text={textContent}
                  searchTerm={searchTerm}
                  matchCase={matchCase}
                  currentMatchIndex={currentMatchIndex}
                  allMatchIndices={matches}
                />
              </div>
            </ScrollArea>
          ) : viewerUrl && isPDF ? (
            <iframe
              src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`}
              className="w-full h-full border-0"
              title="Document Viewer"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Preview not available for this file format.
              </p>
              <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                Download to View
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
