import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Check, 
  X, 
  Building2, 
  User, 
  Clock,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { useAccessRequests, AccessRequest } from "@/hooks/use-access-requests";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function PendingRequestsBadge() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { pendingCount, pendingRequests, approveRequest, rejectRequest, isLoading } = useAccessRequests();

  const handleApprove = async (request: AccessRequest) => {
    setIsProcessing(true);
    const success = await approveRequest(request.id);
    setIsProcessing(false);
    
    if (success) {
      toast.success("Access granted", {
        description: "User has been added to the team"
      });
    } else {
      toast.error("Failed to approve request");
    }
  };

  const handleRejectClick = (request: AccessRequest) => {
    setSelectedRequest(request);
    setRejectReason("");
    setRejectModalOpen(true);
    setPopoverOpen(false);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) return;
    
    setIsProcessing(true);
    const success = await rejectRequest(selectedRequest.id, rejectReason);
    setIsProcessing(false);
    
    if (success) {
      toast.success("Request rejected");
      setRejectModalOpen(false);
      setSelectedRequest(null);
    } else {
      toast.error("Failed to reject request");
    }
  };

  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Requests</span>
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {pendingCount}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b border-border">
            <h4 className="font-semibold text-sm">Pending Access Requests</h4>
            <p className="text-xs text-muted-foreground">
              {pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting your approval
            </p>
          </div>
          
          <ScrollArea className="max-h-[300px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No pending requests
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingRequests.map((request) => (
                  <RequestItem
                    key={request.id}
                    request={request}
                    onApprove={() => handleApprove(request)}
                    onReject={() => handleRejectClick(request)}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for rejecting this request.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Textarea
              placeholder="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? "Rejecting..." : "Reject Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface RequestItemProps {
  request: AccessRequest;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function RequestItem({ request, onApprove, onReject, isProcessing }: RequestItemProps) {
  const EntityIcon = request.entity_type === 'company' ? Building2 : User;
  
  return (
    <div className="p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg shrink-0",
          request.entity_type === 'company' ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
        )}>
          <EntityIcon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium capitalize">{request.entity_type}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
            </span>
          </div>
          
          {request.message && (
            <div className="flex items-start gap-1 mb-2 text-xs text-muted-foreground">
              <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{request.message}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="h-7 gap-1 text-xs"
              onClick={onApprove}
              disabled={isProcessing}
            >
              <Check className="w-3 h-3" />
              Approve
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={onReject}
              disabled={isProcessing}
            >
              <X className="w-3 h-3" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
