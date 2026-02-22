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

// ---------- Deterministic merge scoring ----------

const SENIORITY_RANK: Record<string, number> = {
  "executive": 7, "c-level": 7,
  "director": 6, "vp-director": 6,
  "head": 5,
  "manager": 4,
  "senior": 3, "senior-ic": 3,
  "mid": 2, "ic": 2,
  "junior": 1,
};

const STATUS_RANK: Record<string, number> = {
  "active": 6, "engaged": 5, "new": 4, "inactive": 3, "blocked": 2, "unknown": 1,
};

const VERIFICATION_RANK: Record<string, number> = {
  "verified": 3, "pending": 2, "unverified": 1,
};

function isValidEmail(v?: string | null): boolean {
  return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v?: string | null): boolean {
  return !!v && v.replace(/\D/g, "").length >= 6;
}

function isCorporateEmail(v?: string | null): boolean {
  if (!v) return false;
  const domain = v.split("@")[1]?.toLowerCase() || "";
  return !["gmail.com","yahoo.com","hotmail.com","outlook.com","aol.com","icloud.com","mail.com","protonmail.com"].includes(domain);
}

/** Score a contact for canonical selection per the deterministic rules */
function canonicalScore(c: Contact): number {
  let s = 0;
  if (isValidEmail(c.email)) s += 3;
  if (isValidPhone(c.phone)) s += 3;
  if (c.title) s += 2;
  if (c.department) s += 2;
  if (c.seniority) s += 1;
  if (c.location) s += 1;
  if ((c as any).company_id || (c as any)._companyId) s += 1;
  const vs = (c as any).verification_status || (c as any).verificationStatus;
  if (vs && vs !== "unverified") s += 1;
  return s;
}

function seniorityRank(s?: string | null): number {
  if (!s) return 0;
  return SENIORITY_RANK[s.toLowerCase()] ?? 0;
}

function statusRank(s?: string | null): number {
  if (!s) return 0;
  return STATUS_RANK[s.toLowerCase()] ?? 0;
}

function verificationRank(s?: string | null): number {
  if (!s) return 0;
  return VERIFICATION_RANK[s.toLowerCase()] ?? 0;
}

/** Pick best canonical from a group using scoring + tie-breaks */
function pickCanonical(contacts: Contact[]): string {
  const sorted = [...contacts].sort((a, b) => {
    const diff = canonicalScore(b) - canonicalScore(a);
    if (diff !== 0) return diff;
    // tie-break: newest updated_at
    const ua = (a as any).updated_at || "";
    const ub = (b as any).updated_at || "";
    if (ub > ua) return 1;
    if (ua > ub) return -1;
    // then newest created_at
    const ca = (a as any).created_at || "";
    const cb = (b as any).created_at || "";
    if (cb > ca) return 1;
    if (ca > cb) return -1;
    return 0;
  });
  return sorted[0].id;
}

/** Build deterministic merge patch from canonical + duplicates */
function buildMergePatch(
  canonical: Contact,
  duplicates: Contact[]
): { patch: Record<string, any>; metadata: Record<string, any[]>; notesAppend: string } {
  const patch: Record<string, any> = {};
  const metadata: Record<string, any[]> = {};
  const allContacts = [canonical, ...duplicates];
  const timestamp = new Date().toISOString();

  // --- Name alternates ---
  const altNames = duplicates.map(d => d.name).filter(n => n && n !== canonical.name);
  if (altNames.length) metadata.alternate_names = altNames;

  // --- Email: never overwrite valid canonical ---
  if (!isValidEmail(canonical.email)) {
    const candidates = duplicates
      .filter(d => isValidEmail(d.email))
      .sort((a, b) => {
        const ac = isCorporateEmail(a.email) ? 1 : 0;
        const bc = isCorporateEmail(b.email) ? 1 : 0;
        if (bc !== ac) return bc - ac;
        return ((b as any).updated_at || "") > ((a as any).updated_at || "") ? 1 : -1;
      });
    if (candidates.length) patch.email = candidates[0].email;
  }
  const altEmails = allContacts.map(c => c.email).filter(e => e && e !== (patch.email || canonical.email));
  if (altEmails.length) metadata.alternate_emails = [...new Set(altEmails)];

  // --- Private email ---
  if (!(canonical as any).email_private && !canonical.privateEmail) {
    const pe = duplicates.find(d => (d as any).email_private || d.privateEmail);
    if (pe) patch.email_private = (pe as any).email_private || pe.privateEmail;
  }
  const altPrivate = allContacts.map(c => (c as any).email_private || c.privateEmail).filter(Boolean);
  const keptPrivate = patch.email_private || (canonical as any).email_private || canonical.privateEmail;
  const uniquePrivate = [...new Set(altPrivate.filter((e: string) => e !== keptPrivate))];
  if (uniquePrivate.length) metadata.alternate_private_emails = uniquePrivate;

  // --- Phone: never overwrite valid canonical ---
  if (!isValidPhone(canonical.phone)) {
    const phoneCandidates = duplicates
      .filter(d => isValidPhone(d.phone))
      .sort((a, b) => {
        const aType = a.phoneNumbers?.[0]?.label || "";
        const bType = b.phoneNumbers?.[0]?.label || "";
        const pref = (t: string) => t === "Mobile" ? 2 : t === "Work" ? 1 : 0;
        const tp = pref(bType) - pref(aType);
        if (tp !== 0) return tp;
        return ((b as any).updated_at || "") > ((a as any).updated_at || "") ? 1 : -1;
      });
    if (phoneCandidates.length) patch.phone = phoneCandidates[0].phone;
  }
  const altPhones = allContacts
    .filter(c => c.phone && c.phone !== (patch.phone || canonical.phone))
    .map(c => ({ phone: c.phone, type: c.phoneNumbers?.[0]?.label || "Work" }));
  if (altPhones.length) metadata.alternate_phones = altPhones;

  // --- Title: fill blank only ---
  if (!canonical.title) {
    const t = duplicates.find(d => d.title);
    if (t) patch.title = t.title;
  }
  const altTitles = allContacts.map(c => c.title).filter(t => t && t !== (patch.title || canonical.title));
  if (altTitles.length) metadata.alternate_titles = [...new Set(altTitles)];

  // --- Department: fill blank only ---
  if (!canonical.department) {
    const d = duplicates.find(d => d.department);
    if (d) patch.department = d.department;
  }
  const altDepts = allContacts.map(c => c.department).filter(d => d && d !== (patch.department || canonical.department));
  if (altDepts.length) metadata.alternate_departments = [...new Set(altDepts)];

  // --- Seniority: if empty, use highest rank; never overwrite valid ---
  const canSen = seniorityRank(canonical.seniority);
  if (canSen === 0) {
    let best = { rank: 0, val: "" };
    for (const c of allContacts) {
      const r = seniorityRank(c.seniority);
      if (r > best.rank) best = { rank: r, val: c.seniority! };
    }
    if (best.rank > 0) patch.seniority = best.val;
  }

  // --- Status: keep max-ranked ---
  let bestStatus = { rank: statusRank(canonical.status), val: canonical.status };
  for (const d of duplicates) {
    const r = statusRank(d.status);
    if (r > bestStatus.rank) bestStatus = { rank: r, val: d.status };
  }
  if (bestStatus.val !== canonical.status) patch.status = bestStatus.val;

  // --- Verification status: keep max-ranked ---
  const canVerif = (canonical as any).verification_status || (canonical as any).verificationStatus || "unverified";
  let bestVerif = { rank: verificationRank(canVerif), val: canVerif };
  for (const d of duplicates) {
    const dv = (d as any).verification_status || (d as any).verificationStatus || "unverified";
    const r = verificationRank(dv);
    if (r > bestVerif.rank) bestVerif = { rank: r, val: dv };
  }
  if (bestVerif.val !== canVerif) patch.verification_status = bestVerif.val;

  // --- Location: fill blank ---
  if (!canonical.location) {
    const l = duplicates.find(d => d.location);
    if (l) patch.location = l.location;
  }

  // --- Owner: keep canonical unless empty ---
  const canOwner = (canonical as any).owner_id || canonical.contactOwner;
  if (!canOwner) {
    const o = duplicates.find(d => (d as any).owner_id || d.contactOwner);
    if (o) patch.owner_id = (o as any).owner_id || o.contactOwner;
  }

  // --- manager_id: DEPRECATED — hierarchy lives in org_chart_edges only ---
  // Do not write to contacts.manager_id; org_chart_edges reconciliation handles hierarchy.

  // --- Build provenance notes block ---
  const conflictLines: string[] = [];
  for (const d of duplicates) {
    const diffs: string[] = [];
    if (d.name && d.name !== canonical.name) diffs.push(`name: ${d.name}`);
    if (d.email && d.email !== (patch.email || canonical.email)) diffs.push(`email: ${d.email}`);
    if (d.phone && d.phone !== (patch.phone || canonical.phone)) diffs.push(`phone: ${d.phone}`);
    if (d.title && d.title !== (patch.title || canonical.title)) diffs.push(`title: ${d.title}`);
    if (d.department && d.department !== (patch.department || canonical.department)) diffs.push(`department: ${d.department}`);
    if (d.seniority && d.seniority !== (patch.seniority || canonical.seniority)) diffs.push(`seniority: ${d.seniority}`);
    conflictLines.push(`[MERGED FROM ${d.id} on ${timestamp}]${diffs.length ? " " + diffs.join("; ") : ""}`);
  }

  // Append duplicate notes
  const dupNoteBlocks = duplicates
    .filter(d => d.notes && typeof d.notes === "string" && (d.notes as string).trim())
    .map(d => `[NOTES FROM ${d.id}]: ${typeof d.notes === "string" ? d.notes : ""}`);

  const notesAppend = [...conflictLines, ...dupNoteBlocks].join("\n");

  return { patch, metadata, notesAppend };
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

  /** Auto-select using deterministic scoring */
  const autoSelectCanonicals = () => {
    const map = new Map<string, string>();
    for (const group of duplicateGroups) {
      map.set(group.key, pickCanonical(group.contacts));
    }
    setSelectedCanonical(map);
    setExpandedGroups(new Set(duplicateGroups.map((g) => g.key)));
  };

  const invalidateAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
    queryClient.invalidateQueries({ queryKey: ["org-chart-tree"] });
  };

  /**
   * MERGE: deterministic field-level merge with metadata storage,
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
      // Cross-company guard: block merge if contacts belong to different companies
      const companyIds = new Set(
        group.contacts
          .map(c => (c as any)._companyId || (c as any).company_id)
          .filter(Boolean)
      );
      if (companyIds.size > 1) {
        if (!canDirectAction) {
          toast.error("Cannot merge contacts from different companies. Ask a manager to override.");
          setIsProcessing(false);
          return;
        }
        // Manager/admin override — warn but proceed
        toast.warning("Merging contacts across different companies (manager override).");
      }

      const { patch, metadata, notesAppend } = buildMergePatch(canonical, duplicates);

      // 1. Update canonical with merged fields
      const updatePayload: Record<string, any> = { ...patch };
      const existingNotes = typeof (canonical as any).notes === "string" ? (canonical as any).notes : "";
      const allNotes = [existingNotes, notesAppend].filter(Boolean).join("\n");
      if (allNotes) updatePayload.notes = allNotes;

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase
          .from("contacts")
          .update(updatePayload)
          .eq("id", canonicalId);
        if (error) throw error;
      }

      const dupIds = duplicates.map((d) => d.id);
      const companyId = (canonical as any)._companyId || (canonical as any).company_id || companyFilterId;

      // 2. Company root safety: update ceo_contact_id if it points to a duplicate
      if (companyId) {
        await supabase
          .from("companies")
          .update({ ceo_contact_id: canonicalId })
          .eq("id", companyId)
          .in("ceo_contact_id", dupIds);
      }

      // 3. contacts.manager_id is DEPRECATED — skip writing to it.
      // Hierarchy is managed exclusively via org_chart_edges (step 4).

      // 4. Org chart edge reconciliation (company-scoped)
      // 4a. Re-parent children: edges where parent = duplicate → parent = canonical
      for (const dupId of dupIds) {
        if (companyId) {
          await supabase
            .from("org_chart_edges")
            .update({ parent_contact_id: canonicalId })
            .eq("company_id", companyId)
            .eq("parent_contact_id", dupId);
        } else {
          await supabase
            .from("org_chart_edges")
            .update({ parent_contact_id: canonicalId })
            .eq("parent_contact_id", dupId);
        }
      }

      // 4b. Handle duplicate-as-child edges: migrate or delete
      // Check if canonical already has an edge as child in this company
      const { data: canonicalEdge } = companyId
        ? await supabase
            .from("org_chart_edges")
            .select("id")
            .eq("company_id", companyId)
            .eq("child_contact_id", canonicalId)
            .maybeSingle()
        : { data: null };

      for (const dupId of dupIds) {
        const dupEdgeQuery = companyId
          ? supabase
              .from("org_chart_edges")
              .select("id, parent_contact_id, position_index")
              .eq("company_id", companyId)
              .eq("child_contact_id", dupId)
              .maybeSingle()
          : supabase
              .from("org_chart_edges")
              .select("id, parent_contact_id, position_index")
              .eq("child_contact_id", dupId)
              .maybeSingle();

        const { data: dupEdge } = await dupEdgeQuery;
        if (!dupEdge) continue;

        if (!canonicalEdge) {
          // Canonical has no edge as child → migrate this edge to canonical
          await supabase
            .from("org_chart_edges")
            .update({ child_contact_id: canonicalId })
            .eq("id", dupEdge.id);
        } else {
          // Canonical already has an edge → delete the duplicate's child edge
          // (children already reparented in step 4a)
          await supabase
            .from("org_chart_edges")
            .delete()
            .eq("id", dupEdge.id);
        }
      }

      // 5. Soft-delete duplicates
      const { error: retireErr } = await supabase
        .from("contacts")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", dupIds);
      if (retireErr) throw retireErr;

      // 6. Audit
      await supabase.from("audit_log").insert({
        entity_type: "contact",
        entity_id: canonicalId,
        action: "merge",
        changed_by: user?.id || null,
        diff: {
          merged_from_ids: dupIds,
          fields_applied: patch,
          metadata_stored: metadata,
          before: { email: canonical.email, phone: canonical.phone, title: canonical.title, department: canonical.department, seniority: canonical.seniority, status: canonical.status },
          after: { ...{ email: canonical.email, phone: canonical.phone, title: canonical.title, department: canonical.department, seniority: canonical.seniority, status: canonical.status }, ...patch },
        },
        context: { source: "duplicate_resolution", merge_rule: "deterministic_v3" },
      });

      toast.success(`Merged ${dupIds.length} duplicate(s) into ${canonical.name}`);
      invalidateAfterAction();
      // Also invalidate company queries for ceo_contact_id update
      queryClient.invalidateQueries({ queryKey: ["companies"] });
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
