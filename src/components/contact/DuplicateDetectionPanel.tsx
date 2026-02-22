import { useState, useMemo } from "react";
import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Trash2,
  Merge,
  ChevronDown,
  ChevronRight,
  User,
  Archive,
  ShieldAlert,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceId } from "@/hooks/use-workspace";

interface DuplicateGroup {
  key: string;
  contacts: (Contact & { _companyName?: string; _companyId?: string })[];
}

interface DuplicateDetectionPanelProps {
  contacts: (Contact & { _companyName?: string; _companyId?: string })[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyFilterId?: string | null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/** Score a contact by how many key fields it has filled */
function completenessScore(c: Contact): number {
  return [c.title, c.email, c.department, c.phone].filter(Boolean).length;
}

export function DuplicateDetectionPanel({
  contacts,
  open,
  onOpenChange,
  companyFilterId,
}: DuplicateDetectionPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  const { isAdmin, isManager } = usePermissions();
  const canDirectAction = isAdmin || isManager;

  const [selectedCanonical, setSelectedCanonical] = useState<Map<string, string>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const nameMap = new Map<string, (Contact & { _companyName?: string; _companyId?: string })[]>();
    for (const contact of contacts) {
      const key = normalizeName(contact.name);
      if (!key) continue;
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key)!.push(contact);
    }
    return Array.from(nameMap.entries())
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({ key, contacts: group }))
      .sort((a, b) => b.contacts.length - a.contacts.length);
  }, [contacts]);

  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.contacts.length - 1, 0);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectCanonical = (groupKey: string, contactId: string) => {
    setSelectedCanonical((prev) => {
      const next = new Map(prev);
      next.set(groupKey, contactId);
      return next;
    });
  };

  /** Auto-select the most complete contact as canonical for every group */
  const autoSelectCanonicals = () => {
    const map = new Map<string, string>();
    for (const group of duplicateGroups) {
      const sorted = [...group.contacts].sort((a, b) => completenessScore(b) - completenessScore(a));
      map.set(group.key, sorted[0].id);
    }
    setSelectedCanonical(map);
    setExpandedGroups(new Set(duplicateGroups.map((g) => g.key)));
  };

  /**
   * MERGE: copy missing fields from duplicates into canonical,
   * re-parent org chart children, soft-delete duplicates, write audit.
   */
  const handleMerge = async (group: DuplicateGroup) => {
    const canonicalId = selectedCanonical.get(group.key);
    if (!canonicalId) {
      toast.error("Select a canonical (Keep) contact first");
      return;
    }
    const canonical = group.contacts.find((c) => c.id === canonicalId)!;
    const duplicates = group.contacts.filter((c) => c.id !== canonicalId);

    setIsProcessing(true);
    try {
      // 1. Build merged fields (fill blanks from duplicates)
      const mergeFields: Record<string, any> = {};
      for (const dup of duplicates) {
        if (!canonical.email && dup.email) mergeFields.email = dup.email;
        if (!canonical.phone && dup.phone) mergeFields.phone = dup.phone;
        if (!canonical.title && dup.title) mergeFields.title = dup.title;
        if (!canonical.department && dup.department) mergeFields.department = dup.department;
        if (!(canonical as any).privateEmail && (dup as any).privateEmail) mergeFields.email_private = (dup as any).privateEmail;
      }

      // 2. Update canonical with merged fields (if any)
      if (Object.keys(mergeFields).length > 0) {
        const { error } = await supabase
          .from("contacts")
          .update(mergeFields)
          .eq("id", canonicalId);
        if (error) throw error;
      }

      const dupIds = duplicates.map((d) => d.id);

      // 3. Re-parent org chart: move children of duplicates to canonical
      for (const dupId of dupIds) {
        await supabase
          .from("org_chart_edges")
          .update({ parent_contact_id: canonicalId })
          .eq("parent_contact_id", dupId);
        // Move the duplicate's own edge to point to canonical's parent (or remove)
        await supabase
          .from("org_chart_edges")
          .delete()
          .eq("child_contact_id", dupId);
      }

      // 4. Soft-delete duplicates
      const { error: retireErr } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", dupIds);
      if (retireErr) throw retireErr;

      // 5. Write audit log
      await supabase.from("audit_log").insert({
        entity_type: "contact",
        entity_id: canonicalId,
        action: "merge",
        changed_by: user?.id || null,
        diff: { merged_ids: dupIds, merge_fields: mergeFields },
        context: { source: "duplicate_resolution" },
      });

      toast.success(`Merged ${dupIds.length} duplicate(s) into ${canonical.name}`);
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["org-chart-tree"] });
    } catch (err: any) {
      console.error("[DuplicateDetection] Merge failed:", err);
      toast.error("Merge failed: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * RETIRE: soft-delete selected duplicates, re-parent their org chart children.
   */
  const handleRetire = async (group: DuplicateGroup) => {
    const canonicalId = selectedCanonical.get(group.key);
    if (!canonicalId) {
      toast.error("Select which contact to keep first");
      return;
    }
    const duplicates = group.contacts.filter((c) => c.id !== canonicalId);
    const dupIds = duplicates.map((d) => d.id);

    setIsProcessing(true);
    try {
      // Re-parent org chart children of retired contacts
      for (const dupId of dupIds) {
        // Get the retired contact's parent
        const { data: edge } = await supabase
          .from("org_chart_edges")
          .select("parent_contact_id")
          .eq("child_contact_id", dupId)
          .maybeSingle();
        const newParent = edge?.parent_contact_id || null;

        // Re-parent children to the retired contact's parent
        await supabase
          .from("org_chart_edges")
          .update({ parent_contact_id: newParent })
          .eq("parent_contact_id", dupId);

        // Remove the retired contact's own edge
        await supabase
          .from("org_chart_edges")
          .delete()
          .eq("child_contact_id", dupId);
      }

      // Soft-delete
      const { error } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", dupIds);
      if (error) throw error;

      // Audit
      await supabase.from("audit_log").insert({
        entity_type: "contact",
        entity_id: canonicalId,
        action: "retire_duplicates",
        changed_by: user?.id || null,
        diff: { retired_ids: dupIds },
        context: { source: "duplicate_resolution" },
      });

      toast.success(`Retired ${dupIds.length} duplicate(s)`);
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["org-chart-tree"] });
    } catch (err: any) {
      console.error("[DuplicateDetection] Retire failed:", err);
      toast.error("Retire failed: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * HARD DELETE: admin only. Permanently removes duplicates.
   */
  const handleHardDelete = async (group: DuplicateGroup) => {
    const canonicalId = selectedCanonical.get(group.key);
    if (!canonicalId) {
      toast.error("Select which contact to keep first");
      return;
    }
    const duplicates = group.contacts.filter((c) => c.id !== canonicalId);
    const dupIds = duplicates.map((d) => d.id);

    setIsProcessing(true);
    try {
      // Remove org chart edges first
      for (const dupId of dupIds) {
        await supabase
          .from("org_chart_edges")
          .update({ parent_contact_id: canonicalId })
          .eq("parent_contact_id", dupId);
        await supabase
          .from("org_chart_edges")
          .delete()
          .eq("child_contact_id", dupId);
      }

      // Hard delete
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", dupIds);
      if (error) throw error;

      // Audit
      await supabase.from("audit_log").insert({
        entity_type: "contact",
        entity_id: canonicalId,
        action: "hard_delete_duplicates",
        changed_by: user?.id || null,
        diff: { deleted_ids: dupIds },
        context: { source: "duplicate_resolution" },
      });

      toast.success(`Permanently deleted ${dupIds.length} duplicate(s)`);
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["org-chart-tree"] });
    } catch (err: any) {
      console.error("[DuplicateDetection] Hard delete failed:", err);
      toast.error("Delete failed: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * REQUEST: for non-admin/manager users. Creates a data_change_request.
   */
  const handleRequestChange = async (group: DuplicateGroup, requestType: "merge" | "retire") => {
    if (!user?.id || !workspaceId) {
      toast.error("Not authenticated");
      return;
    }
    const canonicalId = selectedCanonical.get(group.key);
    if (!canonicalId) {
      toast.error("Select which contact to keep first");
      return;
    }
    const dupIds = group.contacts.filter((c) => c.id !== canonicalId).map((c) => c.id);

    setIsProcessing(true);
    try {
      const { error } = await supabase.from("data_change_requests").insert({
        request_type: requestType,
        requested_by: user.id,
        canonical_contact_id: canonicalId,
        duplicate_contact_ids: dupIds,
        company_id: companyFilterId || null,
        workspace_id: workspaceId,
        reason: `User requested ${requestType} for ${group.contacts[0].name} (${dupIds.length} duplicate(s))`,
      });
      if (error) throw error;

      toast.success(`${requestType === "merge" ? "Merge" : "Removal"} request submitted for approval`);
    } catch (err: any) {
      console.error("[DuplicateDetection] Request failed:", err);
      toast.error("Failed to submit request: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 py-5 border-b border-border bg-card shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Detection
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {duplicateGroups.length === 0
              ? "No duplicates found — your contacts are clean!"
              : `Found ${duplicateGroups.length} group${duplicateGroups.length > 1 ? "s" : ""} with ${totalDuplicates} potential duplicate${totalDuplicates > 1 ? "s" : ""}`}
          </p>
          {!canDirectAction && duplicateGroups.length > 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              You can request merge/removal — a manager will approve.
            </p>
          )}
        </SheetHeader>

        {duplicateGroups.length > 0 && (
          <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={autoSelectCanonicals}
            >
              <Merge className="h-3.5 w-3.5 mr-1.5" />
              Auto-select best records
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {duplicateGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                <User className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-foreground">All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">No duplicate contacts detected.</p>
            </div>
          )}

          {duplicateGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const canonicalId = selectedCanonical.get(group.key);

            return (
              <div
                key={group.key}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm text-foreground">
                      {group.contacts[0].name}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs"
                    >
                      {group.contacts.length} records
                    </Badge>
                  </div>
                </button>

                {isExpanded && (
                  <>
                    <div className="border-t border-border divide-y divide-border">
                      {group.contacts.map((contact) => {
                        const isCanonical = canonicalId === contact.id;
                        const isDuplicate = canonicalId && canonicalId !== contact.id;

                        return (
                          <div
                            key={contact.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer",
                              isCanonical && "bg-green-500/5",
                              isDuplicate && "bg-destructive/5"
                            )}
                            onClick={() => selectCanonical(group.key, contact.id)}
                          >
                            <Checkbox
                              checked={isCanonical}
                              onCheckedChange={() => selectCanonical(group.key, contact.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {contact.name}
                                </span>
                                {isCanonical && (
                                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                    Keep
                                  </Badge>
                                )}
                                {isDuplicate && (
                                  <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                    Duplicate
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                                <p>{contact.title || "No title"} · {contact.department || "No department"}</p>
                                <p>{contact.email || "No email"} · {contact.phone || "No phone"}</p>
                                {(contact as any)._companyName && (
                                  <p className="text-primary">{(contact as any)._companyName}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    <div className="border-t border-border px-4 py-3 bg-muted/20 flex flex-wrap gap-2">
                      {canDirectAction ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleMerge(group)}
                            disabled={!canonicalId || isProcessing}
                          >
                            <Merge className="h-3.5 w-3.5 mr-1.5" />
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetire(group)}
                            disabled={!canonicalId || isProcessing}
                          >
                            <Archive className="h-3.5 w-3.5 mr-1.5" />
                            Retire
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleHardDelete(group)}
                              disabled={!canonicalId || isProcessing}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleRequestChange(group, "merge")}
                            disabled={!canonicalId || isProcessing}
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Request Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRequestChange(group, "retire")}
                            disabled={!canonicalId || isProcessing}
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Request Removal
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
