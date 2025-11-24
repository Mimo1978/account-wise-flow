import { useState } from "react";
import { Note } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pin, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface NotesSectionProps {
  notes: Note[];
  onAddNote: (content: string) => void;
  onEditNote: (noteId: string, content: string) => void;
  onPinNote: (noteId: string) => void;
}

export const NotesSection = ({ notes, onAddNote, onEditNote, onPinNote }: NotesSectionProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const filteredNotes = notes.filter(note => 
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handleAddNote = () => {
    if (!newNoteContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    onAddNote(newNoteContent);
    setNewNoteContent("");
    setIsAdding(false);
    toast.success("Note added");
  };

  const handleEditNote = (noteId: string) => {
    if (!editContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    onEditNote(noteId, editContent);
    setEditingNoteId(null);
    setEditContent("");
    toast.success("Note updated");
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {isAdding && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2 animate-fade-in">
          <Textarea
            placeholder="Type your note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddNote}>
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              setIsAdding(false);
              setNewNoteContent("");
            }}>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchQuery ? "No notes found" : "No notes yet"}
          </p>
        ) : (
          sortedNotes.map((note) => (
            <div 
              key={note.id} 
              className="bg-muted/50 rounded-lg p-3 space-y-2 hover:bg-muted/70 transition-colors"
            >
              {editingNoteId === note.id ? (
                <>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEditNote(note.id)}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingNoteId(null);
                      setEditContent("");
                    }}>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{note.author}</span>
                      {note.pinned && (
                        <Badge variant="secondary" className="h-5 px-1.5">
                          <Pin className="w-3 h-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{note.date}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => onPinNote(note.id)}
                      >
                        <Pin className={`w-3 h-3 ${note.pinned ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => startEditing(note)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
