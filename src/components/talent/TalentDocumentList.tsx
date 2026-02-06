import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Download,
  Eye,
  Upload,
  Folder,
  Plus,
  MoreHorizontal,
  Trash2,
  File,
  Loader2,
  Award,
  FilePen,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTalentDocuments } from '@/hooks/use-talent-documents';
import { TalentDocumentUploadModal } from './TalentDocumentUploadModal';
import { TalentDocumentViewer } from './TalentDocumentViewer';
import {
  TalentDocument,
  DocKind,
  docKindConfig,
  formatFileSize,
} from '@/lib/talent-document-types';
import { cn } from '@/lib/utils';

interface TalentDocumentListProps {
  talentId: string;
  talentName: string;
  canEdit?: boolean;
}

const documentIcons: Record<DocKind, React.ElementType> = {
  cv: FileText,
  cover_letter: FilePen,
  certification: Award,
  other: File,
};

const parseStatusConfig = {
  pending: { icon: Clock, label: 'Pending extraction', color: 'text-amber-500' },
  parsed: { icon: CheckCircle2, label: 'Text extracted', color: 'text-green-500' },
  failed: { icon: AlertCircle, label: 'Extraction failed', color: 'text-destructive' },
};

export function TalentDocumentList({
  talentId,
  talentName,
  canEdit = false,
}: TalentDocumentListProps) {
  const {
    documents,
    isLoading,
    isUploading,
    isDownloading,
    uploadError,
    downloadDocument,
    deleteDocument,
    retryExtraction,
  } = useTalentDocuments({ talentId });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<TalentDocument | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<TalentDocument | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Group documents by type
  const documentsByKind = useMemo(() => {
    return documents.reduce((acc, doc) => {
      if (!acc[doc.docKind]) {
        acc[doc.docKind] = [];
      }
      acc[doc.docKind].push(doc);
      return acc;
    }, {} as Record<DocKind, TalentDocument[]>);
  }, [documents]);

  const handleView = (doc: TalentDocument) => {
    setSelectedDocument(doc);
    setShowViewer(true);
  };

  const handleDownload = (doc: TalentDocument) => {
    downloadDocument(doc);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteDocument(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleRetryExtraction = async (doc: TalentDocument) => {
    setRetryingId(doc.id);
    await retryExtraction(doc.id);
    setRetryingId(null);
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

  // Render document item
  const renderDocumentItem = (doc: TalentDocument) => {
    const typeConfig = docKindConfig[doc.docKind];
    const Icon = documentIcons[doc.docKind] || File;
    const parseConfig = parseStatusConfig[doc.parseStatus];
    const ParseIcon = parseConfig.icon;
    const isRetrying = retryingId === doc.id;

    return (
      <div
        key={doc.id}
        className="bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg bg-muted', typeConfig.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {typeConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('flex items-center gap-1', parseConfig.color)}>
                          {isRetrying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ParseIcon className="h-3 w-3" />
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isRetrying ? 'Extracting text...' : parseConfig.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Show retry button for failed extractions */}
                  {doc.parseStatus === 'failed' && !isRetrying && canEdit && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleRetryExtraction(doc)}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Retry text extraction</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
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
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(doc)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">CV & Documents</h3>
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

      {/* Upload error */}
      {uploadError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Upload Failed</p>
              <p className="text-sm text-muted-foreground">{uploadError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 && !isUploading ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-border">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">
            No documents uploaded yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Upload CVs, cover letters, and certifications for this candidate.
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Upload Document
            </Button>
          )}

          {/* Disabled action buttons hint */}
          <div className="mt-6 flex justify-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" disabled className="gap-1.5">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload a document first to enable viewing</TooltipContent>
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
                <TooltipContent>Upload a document first to enable downloading</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => renderDocumentItem(doc))}
        </div>
      )}

      {/* Category Summary */}
      {documents.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {Object.entries(documentsByKind).map(([kind, docs]) => {
              const config = docKindConfig[kind as DocKind];
              return (
                <Badge key={kind} variant="outline" className="gap-1.5">
                  <span className={config.color}>●</span>
                  {config.label}: {docs.length}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <TalentDocumentUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        talentId={talentId}
        talentName={talentName}
        onSuccess={() => setShowUploadModal(false)}
      />

      {/* Document Viewer */}
      <TalentDocumentViewer
        open={showViewer}
        onClose={() => {
          setShowViewer(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        talentId={talentId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.fileName}"? This action cannot be undone.
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
