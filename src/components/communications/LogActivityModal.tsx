import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useCreateCrmActivity } from "@/hooks/use-crm-activities";
import { Loader2 } from "lucide-react";
import type { CrmActivityType, CrmActivityDirection } from "@/types/crm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  companyId?: string | null;
}

export function LogActivityModal({ open, onOpenChange, contactId, companyId }: Props) {
  const [type, setType] = useState<CrmActivityType>("call");
  const [direction, setDirection] = useState<CrmActivityDirection>("outbound");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const createActivity = useCreateCrmActivity();

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    try {
      await createActivity.mutateAsync({
        type,
        direction,
        subject,
        body: notes || null,
        contact_id: contactId,
        company_id: companyId || null,
        status: "completed",
        completed_at: new Date(dateTime).toISOString(),
      });
      toast.success("Activity logged");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as CrmActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={direction} onValueChange={v => setDirection(v as CrmActivityDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Date & Time</Label>
            <Input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createActivity.isPending}>
              {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
