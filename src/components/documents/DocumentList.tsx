import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Download,
  Eye,
  Upload,
  Folder,
  Plus,
  MoreHorizontal,
  Trash2,
  FilePen,
  FileSpreadsheet,
  File,
  CheckCircle2,
  Clock,
  AlertCircle,
  History,
  Star,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useDocuments } from "@/hooks/use-documents";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { DocumentDrawerViewer } from "./DocumentDrawerViewer";
import {
  Document,
  EntityType,
  DocumentType,
  documentTypeConfig,
  formatFileSize,
} from "@/lib/document-types";
import { cn } from "@/lib/utils";

interface DocumentListProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  canEdit?: boolean;
  showCategoryBreakdown?: boolean;
  /** Filter to show only specific document types */
  filterTypes?: DocumentType[];
  /** Compact mode for sidebar display */
  compact?: boolean;
  /** Show version history for documents */
  showVersions?: boolean;
}

const documentIcons: Record<DocumentType, React.ElementType> = {
  cv: FileText,
  cover_letter: FilePen,
  job_spec: FilePen,
  proposal: FileSpreadsheet,
  bid: File,
  contract: FileText,
  nda: FileText,
  sow: FileText,
  other: File,
};

interface DocumentWithVersion extends Document {
  isActive: boolean;
  version: number;
  isLatest: boolean;
}

export function DocumentList({
  entityType,
  entityId,
  entityName,
  canEdit = false,
  showCategoryBreakdown = true,
  filterTypes,
  compact = false,
  showVersions = true,
}: DocumentListProps) {
  const {
    documents,
    isLoading,
    isUploading,
    isDownloading,
    uploadError,
    downloadDocument,
    deleteDocument,
    setActiveDocument,
  } = useDocuments({ entityType, entityId });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Document | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<DocumentType | null>(null);

  // Process documents with version info and filtering
  const processedDocuments = useMemo(() => {
    let docs = [...documents];

    // Apply filter if specified
    if (filterTypes && filterTypes.length > 0) {
      docs = docs.filter((doc) => filterTypes.includes(doc.documentType));
    }

    // Group by type to calculate versions
    const byType: Record<DocumentType, Document[]> = {} as Record<DocumentType, Document[]>;
    docs.forEach((doc) => {
      if (!byType[doc.documentType]) {
        byType[doc.documentType] = [];
      }
      byType[doc.documentType].push(doc);
    });

    // Add version info
    const withVersions: DocumentWithVersion[] = [];
    Object.entries(byType).forEach(([type, typeDocs]) => {
      // Sort by date descending (newest first)
      typeDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      typeDocs.forEach((doc, idx) => {
        withVersions.push({
          ...doc,
          version: typeDocs.length - idx,
          isLatest: idx === 0,
          isActive: doc.isActive ?? idx === 0, // Latest is active by default
        });
      });
    });

    // Sort overall by date
    withVersions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return withVersions;
  }, [documents, filterTypes]);

  // Get active (latest) documents only
  const activeDocuments = useMemo(() => {
    return processedDocuments.filter((doc) => doc.isLatest);
  }, [processedDocuments]);

  // Get version history for a specific type
  const getVersionHistory = (type: DocumentType) => {
    return processedDocuments
      .filter((doc) => doc.documentType === type)
      .sort((a, b) => b.version - a.version);
  };

  // Check if we have any CVs
  const hasCVs = useMemo(() => {
    return processedDocuments.some((doc) => doc.documentType === "cv");
  }, [processedDocuments]);

  // Group documents by type for category breakdown
  const documentsByType = processedDocuments.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<DocumentType, DocumentWithVersion[]>);

  const handleView = (doc: Document) => {
    setSelectedDocument(doc);
    setShowViewer(true);
  };

  const handleDownload = (doc: Document) => {
    downloadDocument(doc);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteDocument(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleSetActive = async (doc: DocumentWithVersion) => {
    if (setActiveDocument) {
      await setActiveDocument(doc.id);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Upload error state
  if (uploadError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Documents & Attachments</h3>
          {canEdit && (
            <Button size="sm" onClick={() => setShowUploadModal(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Retry Upload
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Upload Failed</p>
              <p className="text-sm text-muted-foreground">{uploadError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setShowUploadModal(true)}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
        <DocumentUploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          onSuccess={() => setShowUploadModal(false)}
        />
      </div>
    );
  }

  // Render document item
  const renderDocumentItem = (doc: DocumentWithVersion, showVersionBadge = true) => {
    const typeConfig = documentTypeConfig[doc.documentType];
    const Icon = documentIcons[doc.documentType] || File;
    const hasMultipleVersions = (documentsByType[doc.documentType]?.length || 0) > 1;

    return (
      <div
        key={doc.id}
        className={cn(
          "bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors",
          !doc.isLatest && "opacity-75"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", typeConfig.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  {doc.isLatest && showVersionBadge && hasMultipleVersions && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 text-xs gap-1"
                    >
                      <Star className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                  {!doc.isLatest && showVersionBadge && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      v{doc.version}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {typeConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(doc.fileSizeBytes)}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleView(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Document</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownload(doc)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(canEdit || hasMultipleVersions) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {hasMultipleVersions && showVersions && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setShowVersionHistory(doc.documentType)}
                          >
                            <History className="h-4 w-4 mr-2" />
                            View All Versions ({documentsByType[doc.documentType]?.length})
                          </DropdownMenuItem>
                          {!doc.isLatest && canEdit && setActiveDocument && (
                            <DropdownMenuItem onClick={() => handleSetActive(doc)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set as Active
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {canEdit && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirm(doc)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {filterTypes?.includes("cv") && filterTypes.length === 1
            ? "CV / Resume"
            : "Documents & Attachments"}
        </h3>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => setShowUploadModal(true)}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </>
            )}
          </Button>
        )}
      </div>

      {/* Upload Progress Indicator */}
      {isUploading && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm font-medium">Uploading document...</p>
          </div>
          <Progress value={undefined} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Please wait while your document is being uploaded and processed.
          </p>
        </div>
      )}

      {/* Empty State - No Documents */}
      {activeDocuments.length === 0 && !isUploading ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-border">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {filterTypes?.includes("cv") && filterTypes.length === 1
              ? "No CV uploaded yet"
              : "No documents attached yet"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {filterTypes?.includes("cv") && filterTypes.length === 1
              ? "Upload a CV to enable viewing, downloading, and AI analysis."
              : "Upload documents to keep everything organized in one place."}
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {filterTypes?.includes("cv") && filterTypes.length === 1
                ? "Upload CV"
                : "Add Document"}
            </Button>
          )}
          
          {/* Disabled action buttons hint */}
          {filterTypes?.includes("cv") && filterTypes.length === 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" disabled className="gap-1.5">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload a CV first to enable viewing</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" disabled className="gap-1.5">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload a CV first to enable downloading</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activeDocuments.map((doc) => renderDocumentItem(doc))}
        </div>
      )}

      {/* Document Categories Summary */}
      {showCategoryBreakdown && activeDocuments.length > 0 && !compact && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">By Category</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(documentTypeConfig)
              .filter(([key]) => documentsByType[key as DocumentType]?.length > 0)
              .slice(0, 4)
              .map(([key, config]) => {
                const Icon = documentIcons[key as DocumentType] || File;
                const docs = documentsByType[key as DocumentType] || [];
                const activeCount = docs.filter((d) => d.isLatest).length;
                const totalCount = docs.length;
                return (
                  <div
                    key={key}
                    className={cn(
                      "bg-muted/50 rounded-lg p-3 text-center cursor-pointer hover:bg-muted/70 transition-colors",
                      showVersions && totalCount > activeCount && "ring-1 ring-primary/20"
                    )}
                    onClick={() => totalCount > 1 && setShowVersionHistory(key as DocumentType)}
                  >
                    <Icon className={cn("h-5 w-5 mx-auto mb-1", config.color)} />
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                    <p className="text-lg font-semibold">{activeCount}</p>
                    {showVersions && totalCount > activeCount && (
                      <p className="text-xs text-muted-foreground">
                        +{totalCount - activeCount} older
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Version History Dialog */}
      <AlertDialog
        open={!!showVersionHistory}
        onOpenChange={() => setShowVersionHistory(null)}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History:{" "}
              {showVersionHistory && documentTypeConfig[showVersionHistory]?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              All versions of this document. The active version is used for AI analysis and
              is shown by default. Older versions are retained for reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {showVersionHistory &&
              getVersionHistory(showVersionHistory).map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    doc.isLatest
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium">v{doc.version}</span>
                      {doc.isLatest && (
                        <Badge className="text-[10px] px-1 py-0 bg-primary/20 text-primary">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        handleView(doc);
                        setShowVersionHistory(null);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Modal */}
      <DocumentUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        defaultDocumentType={filterTypes?.[0]}
        onSuccess={() => setShowUploadModal(false)}
      />

      {/* Document Viewer */}
      <DocumentDrawerViewer
        open={showViewer}
        onClose={() => {
          setShowViewer(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
