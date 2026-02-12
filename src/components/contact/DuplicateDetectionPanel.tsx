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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DuplicateGroup {
  key: string;
  contacts: (Contact & { _companyName?: string })[];
}

interface DuplicateDetectionPanelProps {
  contacts: (Contact & { _companyName?: string })[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyFilterId?: string | null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function DuplicateDetectionPanel({
  contacts,
  open,
  onOpenChange,
  companyFilterId,
}: DuplicateDetectionPanelProps) {
  const queryClient = useQueryClient();
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const duplicateGroups = useMemo<DuplicateGroup[]>(() => {
    const nameMap = new Map<string, (Contact & { _companyName?: string })[]>();
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

  const toggleSelect = (id: string) => {
    setSelectedForDeletion((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const autoSelectDuplicates = () => {
    const toSelect = new Set<string>();
    for (const group of duplicateGroups) {
      // Keep the first contact (most complete), select the rest for deletion
      const sorted = [...group.contacts].sort((a, b) => {
        // Prefer the one with more data filled
        const scoreA = [a.title, a.email, a.department, a.phone].filter(Boolean).length;
        const scoreB = [b.title, b.email, b.department, b.phone].filter(Boolean).length;
        return scoreB - scoreA;
      });
      for (let i = 1; i < sorted.length; i++) {
        toSelect.add(sorted[i].id);
      }
    }
    setSelectedForDeletion(toSelect);
    // Expand all groups
    setExpandedGroups(new Set(duplicateGroups.map((g) => g.key)));
  };

  const handleDeleteSelected = async () => {
    if (selectedForDeletion.size === 0) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedForDeletion);
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", ids);

      if (error) throw error;

      toast.success(`Deleted ${ids.length} duplicate contact${ids.length > 1 ? "s" : ""}`);
      setSelectedForDeletion(new Set());
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
    } catch (err: any) {
      toast.error("Failed to delete contacts: " + (err.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
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
        </SheetHeader>

        {duplicateGroups.length > 0 && (
          <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={autoSelectDuplicates}
            >
              <Merge className="h-3.5 w-3.5 mr-1.5" />
              Auto-select duplicates
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedForDeletion.size === 0 || isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete {selectedForDeletion.size > 0 ? `(${selectedForDeletion.size})` : ""}
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
                  <div className="border-t border-border divide-y divide-border">
                    {group.contacts.map((contact, idx) => {
                      const isSelected = selectedForDeletion.has(contact.id);
                      const isKeep = !isSelected && selectedForDeletion.size > 0 &&
                        group.contacts.some((c) => c.id !== contact.id && selectedForDeletion.has(c.id));

                      return (
                        <div
                          key={contact.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 transition-colors",
                            isSelected && "bg-destructive/5",
                            isKeep && "bg-green-500/5"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(contact.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {contact.name}
                              </span>
                              {isKeep && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                  Keep
                                </Badge>
                              )}
                              {isSelected && (
                                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                                  Delete
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
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
