import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface DocumentListProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  canEdit?: boolean;
  showCategoryBreakdown?: boolean;
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

export function DocumentList({
  entityType,
  entityId,
  entityName,
  canEdit = false,
  showCategoryBreakdown = true,
}: DocumentListProps) {
  const {
    documents,
    isLoading,
    isDownloading,
    downloadDocument,
    deleteDocument,
  } = useDocuments({ entityType, entityId });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Document | null>(null);

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

  // Group documents by type for category breakdown
  const documentsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<DocumentType, Document[]>);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Documents & Attachments</h3>
        {canEdit && (
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-border">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No documents attached yet.
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Document
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const typeConfig = documentTypeConfig[doc.documentType];
            const Icon = documentIcons[doc.documentType] || File;

            return (
              <div
                key={doc.id}
                className="bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${typeConfig.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleView(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDownload(doc)}
                          disabled={isDownloading}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteConfirm(doc)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Categories Summary */}
      {showCategoryBreakdown && documents.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">By Category</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(documentTypeConfig)
              .filter(([key]) => documentsByType[key as DocumentType]?.length > 0)
              .slice(0, 4)
              .map(([key, config]) => {
                const Icon = documentIcons[key as DocumentType] || File;
                const count = documentsByType[key as DocumentType]?.length || 0;
                return (
                  <div key={key} className="bg-muted/50 rounded-lg p-3 text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-1 ${config.color}`} />
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                    <p className="text-lg font-semibold">{count}</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
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
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
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
