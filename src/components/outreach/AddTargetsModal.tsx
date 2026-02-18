import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAddTargets } from "@/hooks/use-outreach";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
}

interface Candidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  current_title?: string;
  current_company?: string;
  availability_status?: string;
}

export function AddTargetsModal({ open, onOpenChange, campaignId }: Props) {
  const { currentWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { mutateAsync: addTargets, isPending } = useAddTargets();

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates_for_outreach", currentWorkspace?.id, search],
    enabled: !!currentWorkspace?.id && open,
    queryFn: async () => {
      let q = supabase
        .from("candidates")
        .select("id, name, email, phone, current_title, current_company, availability_status")
        .eq("tenant_id", currentWorkspace!.id)
        .order("name");
      if (search.trim()) q = q.ilike("name", `%${search}%`);
      const { data } = await q.limit(50);
      return (data ?? []) as Candidate[];
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const toAdd = candidates.filter((c) => selected.has(c.id));
    await addTargets(
      toAdd.map((c) => ({
        campaign_id: campaignId,
        candidate_id: c.id,
        entity_name: c.name,
        entity_email: c.email,
        entity_phone: c.phone,
        entity_title: c.current_title,
        entity_company: c.current_company,
      }))
    );
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add Targets to Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          <ScrollArea className="h-72 border rounded-md">
            <div className="p-2 space-y-1">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No candidates found</p>
              ) : (
                candidates.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.current_title, c.current_company].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {c.availability_status && (
                      <Badge
                        variant={c.availability_status === "available" ? "default" : "secondary"}
                        className="text-[10px] shrink-0"
                      >
                        {c.availability_status}
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={selected.size === 0 || isPending}>
                {isPending ? "Adding..." : `Add ${selected.size > 0 ? selected.size : ""} Target${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
