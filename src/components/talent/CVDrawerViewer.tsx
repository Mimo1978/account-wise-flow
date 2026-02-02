import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCandidateCV } from "@/hooks/use-candidate-cv";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CVDrawerViewerProps {
  open: boolean;
  onClose: () => void;
  storagePath: string | null | undefined;
  candidateId: string;
  candidateName: string;
  rawCvText?: string | null;
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
          const isCurrentMatch = currentMatchIndex !== undefined && 
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

export function CVDrawerViewer({
  open,
  onClose,
  storagePath,
  candidateId,
  candidateName,
  rawCvText,
}: CVDrawerViewerProps) {
  const { getSignedUrl, downloadCV, isDownloading } = useCandidateCV();
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

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filename = storagePath
    ? storagePath.split("/").pop() || `${candidateName}_CV.pdf`
    : `${candidateName}_CV.pdf`;

  const isPDF = storagePath?.toLowerCase().endsWith(".pdf");
  const isDoc = storagePath?.toLowerCase().endsWith(".doc") || storagePath?.toLowerCase().endsWith(".docx");

  // Generate text content for DOC/DOCX or when rawCvText is available
  const textContent = useMemo(() => {
    if (rawCvText) {
      return rawCvText;
    }
    if (isDoc) {
      return `Document Preview Not Available\n\nThis Word document requires download to view the full content.\n\nCandidate: ${candidateName}\nFile: ${filename}`;
    }
    return null;
  }, [rawCvText, isDoc, candidateName, filename]);

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
      console.error("[CVDrawerViewer] Error loading document:", err);
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
      setSearchTerm("");
      setCurrentMatchIndex(0);
      setCurrentPage(1);
    }
  }, [open, storagePath, loadDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      // Escape to close search or viewer
      if (e.key === "Escape") {
        if (searchFocused && searchTerm) {
          setSearchTerm("");
          setSearchFocused(false);
        } else {
          onClose();
        }
      }
      // Enter / Shift+Enter to navigate matches
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
      setCurrentPage(prev => prev + 1);
    } else if (direction === "prev" && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Show text-based viewer for DOC/DOCX or when we have raw text
  const showTextViewer = isDoc || (rawCvText && !isPDF);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        className={cn(
          "p-0 flex flex-col gap-0",
          isFullscreen 
            ? "w-full sm:max-w-full" 
            : "w-full sm:max-w-3xl lg:max-w-4xl"
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
                  CV Viewer
                </SheetTitle>
                <p className="text-xs text-muted-foreground truncate">{candidateName}</p>
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
                disabled={isDownloading || !storagePath}
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
                placeholder="Search in CV... (Ctrl+F)"
                className="pl-8 pr-20 h-8 text-sm"
              />
              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {matches.length > 0 
                      ? `${currentMatchIndex + 1}/${matches.length}` 
                      : "0/0"
                    }
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
                  <TooltipContent>Previous match (Shift+Enter)</TooltipContent>
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
                  <TooltipContent>Next match (Enter)</TooltipContent>
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
            
            <span className="text-xs text-muted-foreground w-10 text-center">
              {zoom}%
            </span>
            
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleResetZoom}
                >
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
                
                <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                  Page {currentPage}/{totalPages}
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

        {/* Content Area */}
        <div className="flex-1 overflow-hidden" ref={scrollAreaRef}>
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-[500px] w-full max-w-2xl" />
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
              <div className="p-4">
                {isPDF && !showTextViewer ? (
                  // PDF Viewer
                  <div 
                    className="flex justify-center"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                  >
                    <iframe
                      src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=1&page=${currentPage}`}
                      className="border rounded-lg bg-white shadow-sm w-full"
                      style={{
                        height: "calc(100vh - 180px)",
                        minHeight: "600px",
                        maxWidth: "100%",
                      }}
                      title={`CV - ${candidateName}`}
                    />
                  </div>
                ) : showTextViewer && textContent ? (
                  // Text-based viewer for DOC/DOCX or raw CV text
                  <div 
                    className="bg-card border rounded-lg shadow-sm p-6 max-w-3xl mx-auto"
                    style={{ fontSize: `${zoom}%` }}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        <HighlightedText
                          text={textContent}
                          searchTerm={searchTerm}
                          matchCase={matchCase}
                          currentMatchIndex={currentMatchIndex}
                          allMatchIndices={matches}
                        />
                      </pre>
                    </div>
                  </div>
                ) : (
                  // Fallback: Download prompt
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-md mx-auto">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Preview Not Available</h3>
                    <p className="text-muted-foreground mb-4">
                      This file format cannot be previewed inline. Please download to view.
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

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between p-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">F</kbd> Search</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Next match</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close</span>
          </div>
          {storagePath && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {isPDF ? "PDF" : isDoc ? "DOC" : "Document"}
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
