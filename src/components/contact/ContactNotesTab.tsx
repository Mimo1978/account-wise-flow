import { useState } from "react";
import { Contact, Note, Activity, NoteVisibility } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  Pin, 
  Edit2, 
  Save, 
  X, 
  Calendar, 
  Mail, 
  Phone, 
  TrendingUp, 
  User,
  Globe,
  Users,
  Lock,
  Paperclip
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactNotesTabProps {
  contact: Contact;
}

const visibilityConfig = {
  public: { label: "Public", icon: Globe, className: "text-green-500" },
  team: { label: "Team", icon: Users, className: "text-blue-500" },
  private: { label: "Private", icon: Lock, className: "text-amber-500" },
};

export function ContactNotesTab({ contact }: ContactNotesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteVisibility, setNewNoteVisibility] = useState<NoteVisibility>("team");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  // Mock data - in real app, this would come from the database
  const mockNotes: Note[] = contact.notes || [
    { 
      id: "1", 
      date: "2025-01-22", 
      author: "Sarah Williams", 
      content: "Key decision maker for infrastructure projects. Mentioned budget approval needed by Q2. Very receptive to our proposal for cloud migration.", 
      pinned: true, 
      visibility: "team" 
    },
    { 
      id: "2", 
      date: "2025-01-18", 
      author: "Michael Chen", 
      content: "Technical requirements align well with our platform. Should involve in next technical workshop. Expressed interest in automation capabilities.", 
      visibility: "public" 
    },
    { 
      id: "3", 
      date: "2025-01-15", 
      author: "John Doe", 
      content: "Follow-up on pricing discussion. Needs internal buy-in from finance team.", 
      visibility: "private" 
    },
  ];

  const mockActivities: Activity[] = contact.activities || [
    { id: "1", type: "email", date: "2025-01-23", description: "Followed up on product demo feedback" },
    { id: "2", type: "meeting", date: "2025-01-20", description: "Product demo - very positive response" },
    { id: "3", type: "call", date: "2025-01-15", description: "Initial discovery call - 30 mins" },
    { id: "4", type: "owner-change", date: "2025-01-12", description: "Contact owner changed to Sarah Williams" },
  ];

  const filteredNotes = mockNotes.filter(note => 
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
    // In real app, this would call the API
    toast.success("Note added");
    setNewNoteContent("");
    setNewNoteVisibility("team");
    setIsAddingNote(false);
  };

  const handleEditNote = (noteId: string) => {
    if (!editNoteContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    toast.success("Note updated");
    setEditingNoteId(null);
    setEditNoteContent("");
  };

  const handlePinNote = (noteId: string) => {
    toast.success("Note pinned");
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "meeting": return <Calendar className="h-4 w-4" />;
      case "call": return <Phone className="h-4 w-4" />;
      case "owner-change": return <User className="h-4 w-4" />;
      case "score-change": return <TrendingUp className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const VisibilityIcon = ({ visibility }: { visibility: NoteVisibility }) => {
    const config = visibilityConfig[visibility];
    const Icon = config.icon;
    return <Icon className={cn("h-3 w-3", config.className)} />;
  };

  return (
    <div className="space-y-6">
      {/* Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Notes</h3>
          <Button size="sm" onClick={() => setIsAddingNote(true)} disabled={isAddingNote}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Note
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Add Note Form */}
        {isAddingNote && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 animate-fade-in border border-border">
            <Textarea
              placeholder="Type your note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select value={newNoteVisibility} onValueChange={(v) => setNewNoteVisibility(v as NoteVisibility)}>
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <span className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-green-500" />
                        Public
                      </span>
                    </SelectItem>
                    <SelectItem value="team">
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-blue-500" />
                        Team
                      </span>
                    </SelectItem>
                    <SelectItem value="private">
                      <span className="flex items-center gap-2">
                        <Lock className="h-3 w-3 text-amber-500" />
                        Private
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" disabled>
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  Attach
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddNote}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteContent("");
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className="space-y-3">
          {sortedNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? "No notes found" : "No notes yet. Add your first note to start tracking this relationship."}
            </p>
          ) : (
            sortedNotes.map((note) => (
              <div 
                key={note.id}
                className={cn(
                  "bg-card rounded-lg p-4 space-y-2 border border-border hover:border-primary/20 transition-colors",
                  note.pinned && "border-primary/30 bg-primary/5"
                )}
              >
                {editingNoteId === note.id ? (
                  <>
                    <Textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditNote(note.id)}>
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingNoteId(null);
                        setEditNoteContent("");
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{note.author}</span>
                        {note.pinned && (
                          <Badge variant="secondary" className="h-5 px-1.5">
                            <Pin className="h-3 w-3 fill-current" />
                          </Badge>
                        )}
                        <VisibilityIcon visibility={note.visibility || "team"} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{note.date}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handlePinNote(note.id)}
                        >
                          <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-current text-primary")} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditNoteContent(note.content);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-base font-semibold">Activity Timeline</h3>
        <div className="space-y-3">
          {mockActivities.map((activity, index) => (
            <div key={activity.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="p-2 rounded-full bg-muted text-muted-foreground">
                  {getActivityIcon(activity.type)}
                </div>
                {index < mockActivities.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-2" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
