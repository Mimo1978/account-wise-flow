import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface UnsavedChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndLeave: () => void;
  onDiscardAndLeave: () => void;
  onStay: () => void;
  saving?: boolean;
}

export function UnsavedChangesModal({
  open,
  onOpenChange,
  onSaveAndLeave,
  onDiscardAndLeave,
  onStay,
  saving = false,
}: UnsavedChangesModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onStay}>
            Stay on Page
          </Button>
          <Button variant="destructive" onClick={onDiscardAndLeave}>
            Discard & Go Back
          </Button>
          <Button onClick={onSaveAndLeave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Go Back'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
