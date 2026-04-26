import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Library, Trash2, Pencil, Check, X, PlayCircle, Search, Loader2, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useCallBriefTemplates,
  useDeleteCallBriefTemplate,
  useUpdateCallBriefTemplate,
  useTouchCallBriefTemplate,
  type CallBriefTemplate,
} from "@/hooks/use-call-brief-templates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUseTemplate: (t: CallBriefTemplate) => void;
}

export function CallTemplatesManager({ open, onOpenChange, onUseTemplate }: Props) {
  const { data: templates = [], isLoading } = useCallBriefTemplates();
  const updateTemplate = useUpdateCallBriefTemplate();
  const deleteTemplate = useDeleteCallBriefTemplate();
  const touchTemplate = useTouchCallBriefTemplate();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ name: string; purpose: string; brief: string; enhanced: string }>({
    name: "", purpose: "", brief: "", enhanced: "",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.purpose || "").toLowerCase().includes(q) ||
      t.brief.toLowerCase().includes(q)
    );
  }, [templates, query]);

  const selected = useMemo(
    () => filtered.find(t => t.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  const startEdit = (t: CallBriefTemplate) => {
    setDraft({
      name: t.name,
      purpose: t.purpose || "",
      brief: t.brief,
      enhanced: t.enhanced || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!draft.name.trim() || !draft.brief.trim()) {
      toast.error("Name and brief are required");
      return;
    }
    try {
      await updateTemplate.mutateAsync({
        id: selected.id,
        name: draft.name.trim(),
        purpose: draft.purpose,
        brief: draft.brief,
        enhanced: draft.enhanced,
      });
      toast.success("Template updated");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Couldn't update template");
    }
  };

  const confirmDelete = async (id: string, name: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success(`Deleted "${name}"`);
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      toast.error(e.message || "Couldn't delete template");
    }
  };

  const useNow = (t: CallBriefTemplate) => {
    touchTemplate.mutate(t.id);
    onUseTemplate(t);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[80vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Library className="w-4 h-4 text-primary" /> Call brief templates
            <Badge variant="secondary" className="ml-1">{templates.length}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            View, edit, delete and reuse your saved AI-call scripts on any contact.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr]">
          {/* LEFT: list */}
          <div className="border-r border-border flex flex-col min-h-0">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                  {templates.length === 0
                    ? "No templates saved yet. Save one from any AI call to reuse it here."
                    : "No templates match your search."}
                </div>
              ) : (
                filtered.map(t => {
                  const active = selected?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedId(t.id); setEditing(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors",
                        active ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-accent/40 border-l-2 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                        {t.enhanced && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
                      </div>
                      {t.purpose && (
                        <p className="text-[11px] text-muted-foreground truncate">{t.purpose}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {t.last_used_at
                          ? `Used ${t.use_count}× · ${formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true })}`
                          : `Saved ${formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}`}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: detail / edit */}
          <div className="flex flex-col min-h-0">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a template to view it
              </div>
            ) : (
              <>
                <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {editing ? (
                      <Input
                        value={draft.name}
                        onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                        className="h-8 text-sm font-medium"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Saved {format(new Date(selected.updated_at), "d MMM yyyy, HH:mm")}
                      {selected.last_used_at && <> · last used {format(new Date(selected.last_used_at), "d MMM yyyy")}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!editing ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(selected)} className="h-8 gap-1.5">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => setConfirmDeleteId(selected.id)}
                          className="h-8 text-destructive hover:text-destructive gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                        <Button size="sm" onClick={() => useNow(selected)} className="h-8 gap-1.5">
                          <PlayCircle className="w-3.5 h-3.5" /> Use template
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 gap-1.5">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={updateTemplate.isPending} className="h-8 gap-1.5">
                          {updateTemplate.isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Check className="w-3.5 h-3.5" />}
                          Save changes
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Purpose</Label>
                    {editing ? (
                      <Input
                        value={draft.purpose}
                        onChange={(e) => setDraft(d => ({ ...d, purpose: e.target.value }))}
                        placeholder="e.g. Book a meeting"
                        className="h-8 mt-1 text-sm"
                      />
                    ) : (
                      <p className="text-sm text-foreground mt-1">{selected.purpose || <span className="text-muted-foreground italic">No purpose</span>}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Brief</Label>
                    {editing ? (
                      <Textarea
                        value={draft.brief}
                        onChange={(e) => setDraft(d => ({ ...d, brief: e.target.value }))}
                        rows={5}
                        className="mt-1 text-sm resize-none"
                      />
                    ) : (
                      <div className="mt-1 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">
                        {selected.brief}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      Enhanced AI script {selected.enhanced && <Sparkles className="w-3 h-3 text-primary" />}
                    </Label>
                    {editing ? (
                      <Textarea
                        value={draft.enhanced}
                        onChange={(e) => setDraft(d => ({ ...d, enhanced: e.target.value }))}
                        rows={8}
                        placeholder="Optional — paste or edit the enhanced agent script"
                        className="mt-1 text-sm resize-none"
                      />
                    ) : selected.enhanced ? (
                      <div className="mt-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground whitespace-pre-wrap">
                        {selected.enhanced}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic mt-1">No enhanced script saved.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete template?</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently remove "{templates.find(t => t.id === confirmDeleteId)?.name}". This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive" size="sm"
              onClick={() => {
                const t = templates.find(t => t.id === confirmDeleteId);
                if (t) confirmDelete(t.id, t.name);
              }}
              disabled={deleteTemplate.isPending}
              className="gap-1.5"
            >
              {deleteTemplate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}