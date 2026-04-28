import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useOutreachCampaigns, useUpdateCampaign } from "@/hooks/use-outreach";
import type { ScriptChannel } from "@/lib/script-types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scriptId: string;
  scriptName: string;
  channel: ScriptChannel;
}

/**
 * After saving a script, ask the user if they want to assign it to a
 * specific campaign. Lists only campaigns matching the script's channel
 * (or mixed-channel campaigns). Optional — user can dismiss.
 */
export function AssignToCampaignPrompt({ open, onOpenChange, scriptId, scriptName, channel }: Props) {
  const { data: campaigns = [] } = useOutreachCampaigns();
  const { mutateAsync: updateCampaign, isPending } = useUpdateCampaign();
  const [selectedId, setSelectedId] = useState<string>("");

  // Filter to campaigns where this script's channel is relevant.
  const eligible = useMemo(
    () => campaigns.filter((c) => c.channel === channel || c.channel === ("mixed" as never)),
    [campaigns, channel],
  );

  const fieldFor = (c: ScriptChannel) =>
    c === "email" ? "email_script_id" : c === "sms" ? "sms_script_id" : "call_script_id";

  const handleAssign = async () => {
    if (!selectedId) {
      onOpenChange(false);
      return;
    }
    try {
      await updateCampaign({ id: selectedId, [fieldFor(channel)]: scriptId } as never);
      toast.success(`Script "${scriptName}" assigned to campaign`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign script");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4 text-primary" />
            Assign to a campaign?
          </DialogTitle>
          <DialogDescription>
            Your <span className="font-medium text-foreground">{channel.toUpperCase()}</span> script
            <span className="font-medium text-foreground"> "{scriptName}"</span> is saved. You can assign it
            to an existing campaign now, or skip and assign later from the campaign's Scripts tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs text-muted-foreground">Campaign</Label>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No matching campaigns yet. You can assign this script when you create one.
            </p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a campaign…" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} <span className="text-muted-foreground text-xs">· {c.channel}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Skip for now
          </Button>
          <Button onClick={handleAssign} disabled={isPending || !selectedId} className="gap-2">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Assign to campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}