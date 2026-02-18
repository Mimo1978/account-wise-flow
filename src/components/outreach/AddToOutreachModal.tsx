import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Megaphone, ExternalLink, Users } from "lucide-react";
import { toast } from "sonner";
import { useOutreachCampaigns, useAddTargets, useOutreachTargets } from "@/hooks/use-outreach";
import type { OutreachChannel } from "@/hooks/use-outreach";
import type { Talent } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The selected candidates to add */
  candidates: Talent[];
}

const CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: "call", label: "📞 Call" },
  { value: "email", label: "✉️ Email" },
  { value: "sms", label: "💬 SMS" },
  { value: "linkedin", label: "🔗 LinkedIn" },
  { value: "other", label: "Other" },
];

export function AddToOutreachModal({ open, onOpenChange, candidates }: Props) {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState<string>("");
  const [channel, setChannel] = useState<OutreachChannel | "">("");
  const [priority, setPriority] = useState<number>(5);

  const { data: campaigns = [], isLoading: loadingCampaigns } = useOutreachCampaigns();
  const { mutateAsync: addTargets, isPending } = useAddTargets();

  // Load existing targets for selected campaign (de-dup)
  const { data: existingTargets = [] } = useOutreachTargets({
    campaignId: campaignId || undefined,
  });

  const existingCandidateIds = useMemo(
    () => new Set(existingTargets.map((t) => t.candidate_id).filter(Boolean) as string[]),
    [existingTargets]
  );

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "active" || c.status === "draft"),
    [campaigns]
  );

  const newCandidates = useMemo(
    () => candidates.filter((c) => !existingCandidateIds.has(c.id)),
    [candidates, existingCandidateIds]
  );

  const duplicateCount = candidates.length - newCandidates.length;

  const handleClose = () => {
    setCampaignId("");
    setChannel("");
    setPriority(5);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!campaignId) return;

    if (newCandidates.length === 0) {
      toast.info("All selected candidates are already in this campaign.");
      return;
    }

    await addTargets(
      newCandidates.map((c) => ({
        campaign_id: campaignId,
        candidate_id: c.id,
        entity_type: "candidate" as const,
        entity_name: c.name,
        entity_email: c.email || undefined,
        entity_phone: c.phone || undefined,
        entity_title: c.roleType || undefined,
        entity_company: undefined,
        // priority stored separately via update after insert — addTargets payload
        // Note: priority field is part of the DB default but we pass it here
      }))
    );

    const campaign = campaigns.find((c) => c.id === campaignId);
    toast.success(
      `${newCandidates.length} candidate${newCandidates.length !== 1 ? "s" : ""} added to "${campaign?.name}"`,
      {
        action: {
          label: "Open Campaign",
          onClick: () => navigate(`/outreach?campaign=${campaignId}`),
        },
        duration: 6000,
      }
    );

    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-4 h-4 text-primary" />
            Add to Outreach Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Candidate summary */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} selected
              </p>
              {duplicateCount > 0 && campaignId && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {duplicateCount} already in campaign — {newCandidates.length} will be added
                </p>
              )}
            </div>
            {duplicateCount > 0 && campaignId && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {duplicateCount} skip
              </Badge>
            )}
          </div>

          {/* Campaign picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Campaign</Label>
            {loadingCampaigns ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading campaigns…
              </div>
            ) : activeCampaigns.length === 0 ? (
              <div className="text-sm text-muted-foreground py-1">
                No active campaigns.{" "}
                <button
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => { handleClose(); navigate("/outreach"); }}
                >
                  Create one in Outreach
                </button>
              </div>
            ) : (
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign…" />
                </SelectTrigger>
                <SelectContent>
                  {activeCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.name}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 capitalize ml-1"
                        >
                          {c.status}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Channel preference */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Channel preference{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as OutreachChannel | "")}>
              <SelectTrigger>
                <SelectValue placeholder="Use campaign default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use campaign default</SelectItem>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Priority</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {priority} / 10
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[priority]}
              onValueChange={([v]) => setPriority(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Lower</span>
              <span>Higher</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!campaignId || isPending || newCandidates.length === 0}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5" />
                Add {newCandidates.length > 0 ? newCandidates.length : ""} to Campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
