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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from "lucide-react";
import {
  useDeletionPermission,
  useSoftDelete,
  useRequestDeletion,
  usePurgeRecord,
  type DeletableRecordType,
} from "@/hooks/use-deletion";

interface DeleteRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType: DeletableRecordType;
  recordId: string;
  recordName: string;
  /** Optional: is this user the record owner? */
  isOwner?: boolean;
  /** Called after successful deletion/request */
  onDeleted?: () => void;
  /** For purge flow */
  isPurge?: boolean;
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
  isPurge = false,
}: DeleteRecordModalProps) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const perm = useDeletionPermission();
  const softDelete = useSoftDelete();
  const requestDeletion = useRequestDeletion();
  const purgeRecord = usePurgeRecord();

  const typeLabel = TYPE_LABELS[recordType] || recordType;
  const isProcessing = softDelete.isPending || requestDeletion.isPending || purgeRecord.isPending;

  // Determine which flow to show
  const canDirectDelete = perm.canDeleteDirectly || (perm.canDeleteOwn && isOwner);

  const handleClose = () => {
    setReason("");
    setConfirmText("");
    onOpenChange(false);
  };

  const handleSoftDelete = async () => {
    if (!reason.trim()) return;
    await softDelete.mutateAsync({
      recordType,
      recordId,
      recordName,
      reason: reason.trim(),
    });
    handleClose();
    onDeleted?.();
  };

  const handleRequestDeletion = async () => {
    if (!reason.trim()) return;
    await requestDeletion.mutateAsync({
      recordType,
      recordId,
      recordName,
      reason: reason.trim(),
    });
    handleClose();
  };

  const handlePurge = async () => {
    if (confirmText !== "DELETE") return;
    await purgeRecord.mutateAsync({ recordType, recordId });
    handleClose();
    onDeleted?.();
  };

  // PURGE FLOW (admin only)
  if (isPurge) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Permanently Purge {typeLabel}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will <strong>permanently delete</strong>{" "}
                <span className="font-semibold text-foreground">{recordName}</span> and all linked data.
                This action cannot be undone.
              </p>
              <div className="space-y-2">
                <Label className="text-sm">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={confirmText !== "DELETE" || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Purge Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // FLOW A/B — Direct delete (Admin or Manager-own)
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
              <div className="space-y-3">
                <p>
                  This will remove <strong>{recordName}</strong> from all views.
                  The record will be recoverable for <strong>30 days</strong> before permanent deletion.
                </p>

                {perm.role === "manager" && !perm.canDeleteDirectly && (
                  <p className="text-xs text-muted-foreground italic">
                    This deletion will be logged and visible to workspace admins.
                  </p>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Reason for deletion <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this record being deleted?"
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleSoftDelete}
              disabled={!reason.trim() || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-1" />
              Delete & recover later
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // FLOW C — Contributor requesting deletion
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Why should this be deleted? <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this record should be removed…"
                  rows={3}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleRequestDeletion}
            disabled={!reason.trim() || isProcessing}
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
