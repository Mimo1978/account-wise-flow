import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreVertical, Edit2, Trash2, Clock, User, Tag, Eye, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CandidateNote {
  id: string;
  title: string | null;
  body: string;
  tags: string[];
  visibility: "public" | "team" | "private";
  is_deleted: boolean;
  deletion_requested_by: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CandidateNotesSectionProps {
  candidateId: string;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string | null;
}

const visibilityIcons = {
  public: <Eye className="h-3 w-3" />,
  team: <User className="h-3 w-3" />,
  private: <Lock className="h-3 w-3" />,
};

const visibilityLabels = {
  public: "Public",
  team: "Team",
  private: "Private",
};

const tagOptions = ["Interview", "Rate", "Client feedback", "Technical", "Availability", "Reference"];

export function CandidateNotesSection({
  candidateId,
  canEdit,
  canDelete,
  currentUserId,
}: CandidateNotesSectionProps) {
  const { currentWorkspace } = useWorkspace();
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<CandidateNote | null>(null);
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<CandidateNote | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "team" | "private">("team");

  useEffect(() => {
    fetchNotes();
  }, [candidateId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("candidate_notes")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data || []) as CandidateNote[]);
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!body.trim()) {
      toast.error("Note body is required");
      return;
    }

    try {
      const { error } = await supabase.from("candidate_notes").insert({
        candidate_id: candidateId,
        title: title.trim() || null,
        body: body.trim(),
        tags: selectedTags,
        visibility,
        owner_id: currentUserId,
        team_id: currentWorkspace?.id,
      });

      if (error) throw error;

      toast.success("Note added");
      setShowAddModal(false);
      resetForm();
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !body.trim()) return;

    try {
      const { error } = await supabase
        .from("candidate_notes")
        .update({
          title: title.trim() || null,
          body: body.trim(),
          tags: selectedTags,
          visibility,
        })
        .eq("id", editingNote.id);

      if (error) throw error;

      toast.success("Note updated");
      setEditingNote(null);
      resetForm();
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || "Failed to update note");
    }
  };

  const handleDeleteNote = async (note: CandidateNote) => {
    try {
      if (canDelete) {
        // Hard delete
        const { error } = await supabase
          .from("candidate_notes")
          .delete()
          .eq("id", note.id);
        if (error) throw error;
        toast.success("Note deleted");
      } else {
        // Soft delete request
        const { error } = await supabase
          .from("candidate_notes")
          .update({
            is_deleted: true,
            deletion_requested_by: currentUserId,
            deletion_requested_at: new Date().toISOString(),
          })
          .eq("id", note.id);
        if (error) throw error;
        toast.success("Deletion requested");
      }
      setDeleteConfirmNote(null);
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    }
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSelectedTags([]);
    setVisibility("team");
  };

  const openEditModal = (note: CandidateNote) => {
    setTitle(note.title || "");
    setBody(note.body);
    setSelectedTags(note.tags || []);
    setVisibility(note.visibility);
    setEditingNote(note);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const canEditNote = (note: CandidateNote) => {
    return canEdit && (canDelete || note.owner_id === currentUserId);
  };

  const canDeleteNote = (note: CandidateNote) => {
    return canDelete || note.owner_id === currentUserId;
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Note Button */}
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {note.title && (
                    <h4 className="font-medium text-sm mb-1">{note.title}</h4>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                </div>
                {(canEditNote(note) || canDeleteNote(note)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditNote(note) && (
                        <DropdownMenuItem onClick={() => openEditModal(note)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDeleteNote(note) && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirmNote(note)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {canDelete ? "Delete" : "Request Deletion"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
                <span className="flex items-center gap-1">
                  {visibilityIcons[note.visibility]}
                  {visibilityLabels[note.visibility]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Note Modal */}
      <Dialog
        open={showAddModal || !!editingNote}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingNote(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Add Note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Textarea
                placeholder="Note content..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Visibility</label>
              <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Public
                    </span>
                  </SelectItem>
                  <SelectItem value="team">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Team Only
                    </span>
                  </SelectItem>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Private
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingNote(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingNote ? handleUpdateNote : handleAddNote}>
              {editingNote ? "Save Changes" : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmNote}
        onOpenChange={(open) => !open && setDeleteConfirmNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canDelete ? "Delete Note" : "Request Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canDelete
                ? "Are you sure you want to delete this note? This action cannot be undone."
                : "This will mark the note for deletion. An admin or manager will review the request."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmNote && handleDeleteNote(deleteConfirmNote)}
            >
              {canDelete ? "Delete" : "Request Deletion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
