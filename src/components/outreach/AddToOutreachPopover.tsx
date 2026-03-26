import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddToOutreachPopoverProps {
  workspaceId: string;
  entityName: string;
  entityEmail?: string;
  entityPhone?: string;
  entityTitle?: string;
  entityCompany?: string;
  contactId?: string;
  candidateId?: string;
  trigger?: React.ReactNode;
}

export function AddToOutreachPopover({
  workspaceId,
  entityName,
  entityEmail,
  entityPhone,
  entityTitle,
  entityCompany,
  contactId,
  candidateId,
  trigger,
}: AddToOutreachPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["outreach_campaigns_active", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outreach_campaigns")
        .select("id, name, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "draft"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open && !!workspaceId,
  });

  const handleAdd = async () => {
    if (!selectedCampaignId) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("outreach_targets").insert({
        workspace_id: workspaceId,
        campaign_id: selectedCampaignId,
        contact_id: contactId || null,
        candidate_id: candidateId || null,
        entity_name: entityName,
        entity_email: entityEmail || null,
        entity_phone: entityPhone || null,
        entity_title: entityTitle || null,
        entity_company: entityCompany || null,
        state: "queued",
        priority: 5,
      } as any);
      if (error) throw error;

      const campaign = campaigns.find((c) => c.id === selectedCampaignId);
      toast.success(`${entityName} added to ${campaign?.name || "campaign"}`);
      queryClient.invalidateQueries({ queryKey: ["outreach_targets"], exact: false });
      setOpen(false);
      setSelectedCampaignId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add to outreach");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Add to outreach campaign"
            onClick={(e) => e.stopPropagation()}
          >
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium mb-2">Add to campaign</p>
        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active campaigns. Create one in Outreach first.
          </p>
        ) : (
          <>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="h-8 text-xs mb-2">
                <SelectValue placeholder="Select campaign…" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              disabled={!selectedCampaignId || adding}
              onClick={handleAdd}
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Add to selected campaign
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
