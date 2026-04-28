import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Check, Loader2, Mail, Phone, MessageSquare, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type EntityType = "candidate" | "contact";

interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  entityEmail?: string | null;
  entityPhone?: string | null;
  entityTitle?: string | null;
  entityCompany?: string | null;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
  bright?: boolean;
}

const channelIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  sms: MessageSquare,
  linkedin: Linkedin,
  multi: Megaphone,
};

export function AddToCampaignButton({
  entityType,
  entityId,
  entityName,
  entityEmail,
  entityPhone,
  entityTitle,
  entityCompany,
  size = "sm",
  variant = "outline",
  bright = false,
}: Props) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["active-campaigns-for-add", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("outreach_campaigns")
        .select("id, name, status, channel, job_spec_id, job_specs:job_spec_id(id, title, client_company_id, companies:client_company_id(name))")
        .eq("workspace_id", currentWorkspace.id)
        .in("status", ["draft", "active", "paused"])
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!currentWorkspace?.id,
  });

  // Find campaigns the entity is already in (to show check + dedupe)
  const { data: existingTargets = [] } = useQuery({
    queryKey: ["entity-campaigns", entityType, entityId],
    queryFn: async () => {
      const filter = entityType === "candidate" ? { candidate_id: entityId } : { contact_id: entityId };
      const { data, error } = await supabase
        .from("outreach_targets")
        .select("campaign_id")
        .match(filter);
      if (error) throw error;
      return (data || []).map((t) => t.campaign_id);
    },
    enabled: open && !!entityId,
  });

  const handleAdd = async (campaignId: string, campaignName: string) => {
    if (!currentWorkspace?.id) return;
    if (existingTargets.includes(campaignId)) {
      toast.info(`${entityName} is already in "${campaignName}"`);
      setOpen(false);
      return;
    }
    setAdding(campaignId);
    try {
      const payload: any = {
        workspace_id: currentWorkspace.id,
        campaign_id: campaignId,
        entity_type: entityType,
        entity_name: entityName,
        entity_email: entityEmail || null,
        entity_phone: entityPhone || null,
        entity_title: entityTitle || null,
        entity_company: entityCompany || null,
        state: "queued",
      };
      if (entityType === "candidate") payload.candidate_id = entityId;
      else payload.contact_id = entityId;

      const { error } = await supabase.from("outreach_targets").insert(payload);
      if (error) throw error;

      // Bump campaign target count (best-effort)
      await supabase.rpc("increment_campaign_target_count", {
        p_campaign_id: campaignId,
        p_count: 1,
      });

      toast.success(`${entityName} added to "${campaignName}"`);
      queryClient.invalidateQueries({ queryKey: ["entity-campaigns", entityType, entityId] });
      setOpen(false);
    } catch (err: any) {
      console.error("[AddToCampaign] insert failed", err);
      toast.error(err?.message || "Failed to add to campaign");
    } finally {
      setAdding(null);
    }
  };

  // Group campaigns by linked Job spec (or "No linked role")
  const grouped = campaigns.reduce<Record<string, typeof campaigns>>((acc, c: any) => {
    const key = c.job_specs
      ? `${c.job_specs.title}${c.job_specs.companies?.name ? ` · ${c.job_specs.companies.name}` : ""}`
      : "No linked role";
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {bright ? (
          <Button
            size={size}
            className="gap-1.5 bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/50 hover:bg-fuchsia-500/25 hover:text-fuchsia-200 hover:border-fuchsia-400/70 shadow-[0_0_12px_-2px_hsl(292_84%_61%/0.45)]"
          >
            <Megaphone className="h-4 w-4" />
            Add to Campaign
          </Button>
        ) : (
          <Button variant={variant} size={size} className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Add to Campaign
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto bg-popover">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Add {entityName} to an outreach campaign
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading campaigns…
          </div>
        )}
        {!isLoading && campaigns.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No active campaigns. Create one in Outreach first.
          </div>
        )}
        {!isLoading &&
          Object.entries(grouped).map(([groupName, list]) => (
            <div key={groupName}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pt-2">
                {groupName}
              </DropdownMenuLabel>
              {list.map((c: any) => {
                const Icon = channelIcon[c.channel] || Megaphone;
                const already = existingTargets.includes(c.id);
                const isBusy = adding === c.id;
                return (
                  <DropdownMenuItem
                    key={c.id}
                    disabled={isBusy}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleAdd(c.id, c.name);
                    }}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-sm">{c.name}</span>
                      <span className="text-[10px] uppercase text-muted-foreground/60 shrink-0">
                        {c.status}
                      </span>
                    </div>
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    ) : already ? (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}