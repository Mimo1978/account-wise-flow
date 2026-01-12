import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPlus, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAccessRequests } from "@/hooks/use-access-requests";

interface RequestAccessModalProps {
  entityType: 'company' | 'contact';
  entityId: string;
  entityName: string;
  children?: React.ReactNode;
}

export function RequestAccessModal({ 
  entityType, 
  entityId, 
  entityName,
  children 
}: RequestAccessModalProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createRequest, hasRequestedAccess } = useAccessRequests();
  const alreadyRequested = hasRequestedAccess(entityType, entityId);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const success = await createRequest(entityType, entityId, message);
    setIsSubmitting(false);
    
    if (success) {
      toast.success("Access request sent", {
        description: "You'll be notified when it's reviewed"
      });
      setMessage("");
      setOpen(false);
    } else {
      toast.error("Failed to send request", {
        description: "Please try again later"
      });
    }
  };

  if (alreadyRequested) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Clock className="w-4 h-4" />
        Request Pending
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Request Edit Access
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Request Edit Access
          </DialogTitle>
          <DialogDescription>
            Request access to edit <strong>{entityName}</strong>. The owner or a team member will review your request.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Why do you need edit access?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
