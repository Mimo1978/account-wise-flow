import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2, Trash2, ShieldAlert, ExternalLink, ArrowRightLeft } from "lucide-react";
import {
  useDeletionPermission,
  useHardDelete,
  useRequestDeletion,
  type DeletableRecordType,
} from "@/hooks/use-deletion";
import { useDependencyCheck, type Dependency } from "@/hooks/use-dependency-check";
import { useDependencyDelete } from "@/hooks/use-dependency-delete";
import { useNavigate } from "react-router-dom";

interface DeleteRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType: DeletableRecordType;
  recordId: string;
  recordName: string;
  isOwner?: boolean;
  onDeleted?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  crm_projects: "Project",
  crm_deals: "Deal",
  crm_companies: "Company",
  crm_contacts: "Contact",
  crm_invoices: "Invoice",
  crm_documents: "Document",
  companies: "Company",
  contacts: "Contact",
  jobs: "Job",
  engagements: "Project",
};

export function DeleteRecordModal({
  open,
  onOpenChange,
  recordType,
  recordId,
  recordName,
  isOwner = false,
  onDeleted,
}: DeleteRecordModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const perm = useDeletionPermission();
  const requestDeletion = useRequestDeletion();
  const depCheck = useDependencyCheck(recordType, recordId, open);
  const depDelete = useDependencyDelete();
  const navigate = useNavigate();

  const typeLabel = TYPE_LABELS[recordType] || recordType;
  const isProcessing = depDelete.isPending || requestDeletion.isPending;
  const canDirectDelete = perm.canDeleteDirectly || (perm.canDeleteOwn && isOwner);

  const handleClose = () => {
    setConfirmText("");
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (confirmText !== recordName) return;
    try {
      await depDelete.mutateAsync({ recordType, recordId, recordName });
      handleClose();
      onDeleted?.();
    } catch {
      // error handled in hook
    }
  };

  const handleRequestDeletion = async () => {
    await requestDeletion.mutateAsync({
      recordType,
      recordId,
      recordName,
      reason: `Deletion requested for ${typeLabel}: ${recordName}`,
    });
    handleClose();
  };

  // Loading state
  if (depCheck.isLoading && open) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking linked records…</span>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const blockingDeps = depCheck.dependencies.filter((d) => d.blocking);
  const nonBlockingDeps = depCheck.dependencies.filter((d) => !d.blocking && d.count > 0);

  // ═══ BLOCKED — has active deals/unpaid invoices ═══
  if (depCheck.hasBlocking && canDirectDelete) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Cannot delete {typeLabel}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  <strong>{recordName}</strong> has linked records that must be resolved first:
                </p>

                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  {blockingDeps.map((dep) => (
                    <div key={dep.type} className="flex items-center justify-between text-sm">
                      <span className="text-destructive font-medium">• {dep.label}</span>
                      {dep.viewPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            handleClose();
                            navigate(dep.viewPath!);
                          }}
                        >
                          View <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {nonBlockingDeps.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Also linked:</p>
                    {nonBlockingDeps.map((dep) => (
                      <p key={dep.type}>• {dep.label}</p>
                    ))}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Close or transfer the active deals and resolve unpaid invoices before deleting this {typeLabel.toLowerCase()}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ═══ WARNING — has non-blocking dependencies ═══
  if (depCheck.hasAny && !depCheck.hasBlocking && canDirectDelete) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {typeLabel}: {recordName}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    This will also affect:
                  </p>
                  {nonBlockingDeps.map((dep) => (
                    <p key={dep.type} className="text-sm text-amber-700 dark:text-amber-300">
                      • {dep.label}
                    </p>
                  ))}
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    These records will be unlinked but not deleted.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Type <span className="font-semibold text-foreground">"{recordName}"</span> to confirm:
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={recordName}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== recordName || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ═══ SIMPLE — no dependencies, direct delete ═══
  if (canDirectDelete) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {typeLabel}: {recordName}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  This will permanently delete <strong>{recordName}</strong>. This action cannot be undone.
                </p>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Type <span className="font-semibold text-foreground">"{recordName}"</span> to confirm:
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={recordName}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== recordName || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // ═══ REQUEST DELETION — contributor flow ═══
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Request Deletion: {recordName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You don't have permission to delete directly. Your request will be sent to a workspace admin for review.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleRequestDeletion}
            disabled={isProcessing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Submit deletion request
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
