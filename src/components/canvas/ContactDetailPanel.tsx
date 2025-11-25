import { useState, useEffect } from "react";
import { Contact, Note, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceInput } from "./VoiceInput";
import { 
  X, 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  Calendar, 
  TrendingUp, 
  User,
  Linkedin,
  MapPin,
  Edit2,
  Save,
  Sparkles,
  Tag,
  Clock,
  Maximize2,
  Minimize2,
  FileText,
  Activity as ActivityIcon,
  Pin,
  Plus,
  Search
} from "lucide-react";
import { toast } from "sonner";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

const statusConfig = {
  champion: { label: "Champion", color: "bg-node-champion text-white" },
  engaged: { label: "Engaged", color: "bg-node-engaged text-white" },
  warm: { label: "Warm", color: "bg-node-warm text-white" },
  new: { label: "New", color: "bg-node-new text-white" },
  blocker: { label: "Blocker", color: "bg-node-blocker text-white" },
  unknown: { label: "Unknown", color: "bg-node-unknown text-foreground" },
};

const roleConfig = {
  "economic-buyer": "Economic Buyer",
  "technical-evaluator": "Technical Evaluator",
  "champion": "Champion",
  "blocker": "Blocker",
  "influencer": "Influencer",
};

const seniorityConfig = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-level",
  junior: "Junior",
};

const predefinedTags = [
  "Decision Maker",
  "Do Not Contact",
  "VIP",
  "New Hire",
  "Internal Champion",
  "Budget Holder",
  "Technical Expert",
  "Key Stakeholder"
];

export const ContactDetailPanel = ({ 
  contact, 
  onClose, 
  isExpanded = false, 
  onExpandToggle,
  onUnsavedChanges 
}: ContactDetailPanelProps) => {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedContact, setEditedContact] = useState(contact);
  const [expandedSection, setExpandedSection] = useState<string>("ai-insights");
  
  // Notes state
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  useEffect(() => {
    if (contact && editedContact) {
      const hasChanges = JSON.stringify(contact) !== JSON.stringify(editedContact);
      onUnsavedChanges?.(hasChanges);
    }
  }, [editedContact, contact, onUnsavedChanges]);

  useEffect(() => {
    setEditedContact(contact);
  }, [contact]);

  if (!contact || !editedContact) return null;

  const statusInfo = statusConfig[editedContact.status];

  const mockNotes: Note[] = editedContact.notes || [
    { id: "1", date: "2025-01-22", author: "Sarah Williams", content: "Key decision maker for infrastructure projects. Mentioned budget approval needed by Q2.", pinned: true },
    { id: "2", date: "2025-01-18", author: "Michael Chen", content: "Technical requirements align well with our platform. Should involve in next technical workshop." },
  ];

  const mockActivities: Activity[] = editedContact.activities || [
    { id: "1", type: "email", date: "2025-01-23", description: "Followed up on product demo feedback" },
    { id: "2", type: "meeting", date: "2025-01-20", description: "Product demo - very positive response" },
    { id: "3", type: "call", date: "2025-01-15", description: "Initial discovery call" },
    { id: "4", type: "owner-change", date: "2025-01-12", description: "Contact owner changed to Sarah Williams" },
    { id: "5", type: "score-change", date: "2025-01-10", description: "Engagement score increased from 45 to 72", metadata: { "Previous": "45", "New": "72" } },
  ];

  const filteredNotes = mockNotes.filter(note => 
    note.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
    note.author.toLowerCase().includes(noteSearchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handleSave = (field: string, value: any) => {
    setEditedContact({ ...editedContact, [field]: value });
    setIsEditing(null);
    toast.success("Updated successfully");
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    console.log("Adding note:", newNoteContent);
    setNewNoteContent("");
    setIsAddingNote(false);
    toast.success("Note added");
  };

  const handleEditNote = (noteId: string) => {
    if (!editNoteContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    console.log("Editing note:", noteId, editNoteContent);
    setEditingNoteId(null);
    setEditNoteContent("");
    toast.success("Note updated");
  };

  const handlePinNote = (noteId: string) => {
    console.log("Pinning note:", noteId);
    toast.success("Note pinned");
  };

  const handleAddTag = (tag: string) => {
    const currentTags = editedContact.tags || [];
    if (!currentTags.includes(tag)) {
      setEditedContact({ ...editedContact, tags: [...currentTags, tag] });
      toast.success("Tag added");
    }
  };

  const handleRemoveTag = (tag: string) => {
    const currentTags = editedContact.tags || [];
    setEditedContact({ ...editedContact, tags: currentTags.filter(t => t !== tag) });
    toast.success("Tag removed");
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handlePhotoDataExtracted = (data: any) => {
    setEditedContact({
      ...editedContact,
      name: data.name || editedContact.name,
      email: data.email || editedContact.email,
      title: data.title || editedContact.title,
      phone: data.phone || editedContact.phone,
    });
    toast.success("Contact data extracted and pre-filled");
  };

  const handleVoiceTranscript = (transcript: string) => {
    setNewNoteContent(transcript);
    setIsAddingNote(true);
    setExpandedSection("notes");
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="w-4 h-4" />;
      case "meeting": return <Calendar className="w-4 h-4" />;
      case "call": return <Phone className="w-4 h-4" />;
      case "owner-change": return <User className="w-4 h-4" />;
      case "score-change": return <TrendingUp className="w-4 h-4" />;
      default: return <ActivityIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className={`h-full border-l border-border bg-background flex flex-col transition-all duration-300 ${
      isExpanded ? 'w-full animate-scale-in' : 'w-[520px] animate-slide-in-right'
    }`}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        {/* Quick Capture Tools & Expand Button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <PhotoCapture onDataExtracted={handlePhotoDataExtracted} />
            <VoiceInput onTranscriptComplete={handleVoiceTranscript} />
          </div>
          <div className="flex items-center gap-2">
            {onExpandToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpandToggle}
                title={isExpanded ? "Collapse to side panel" : "Expand to full screen"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <Avatar className="w-16 h-16 shrink-0">
              <AvatarImage src={editedContact.profilePhoto} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(editedContact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-2">
              {isEditing === "name" ? (
                <div className="space-y-3">
                  <Input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="text-lg font-bold h-10"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave("name", editedContact.name)}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{editedContact.name}</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                    onClick={() => setIsEditing("name")}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              
              {isEditing === "title" ? (
                <div className="space-y-3">
                  <Input
                    value={editedContact.title}
                    onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                    className="h-9"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave("title", editedContact.title)}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <p className="text-sm text-muted-foreground truncate">{editedContact.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                    onClick={() => setIsEditing("title")}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Status & Tags */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                {editedContact.role && (
                  <Badge variant="outline">{roleConfig[editedContact.role]}</Badge>
                )}
                {editedContact.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Add Tag */}
              <Select onValueChange={handleAddTag}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="+ Add tag" />
                </SelectTrigger>
                <SelectContent>
                  {predefinedTags
                    .filter(tag => !editedContact.tags?.includes(tag))
                    .map((tag) => (
                      <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Single Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4">
          <Accordion 
            type="single" 
            collapsible 
            value={expandedSection} 
            onValueChange={setExpandedSection}
            className="space-y-3"
          >
            {/* AI Insights Section */}
            <AccordionItem value="ai-insights" className="border border-primary/20 rounded-lg bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold">AI Insights</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    High engagement contact with strong buying signals. Recommended next action: Schedule technical deep-dive within 7 days.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span>Engagement trending upward</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contact Information Section */}
            <AccordionItem value="contact-info" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <span className="font-semibold">Contact Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-4">
                  {/* Email */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 group">
                    <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                    {isEditing === "email" ? (
                      <div className="flex-1 space-y-3">
                        <Input
                          type="email"
                          value={editedContact.email}
                          onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                          className="h-10"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSave("email", editedContact.email)}>
                            <Save className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <a href={`mailto:${editedContact.email}`} className="text-primary hover:underline flex-1 text-sm">
                          {editedContact.email}
                        </a>
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0" onClick={() => setIsEditing("email")}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 group">
                    <Phone className="w-5 h-5 text-muted-foreground shrink-0" />
                    {isEditing === "phone" ? (
                      <div className="flex-1 space-y-3">
                        <Input
                          type="tel"
                          value={editedContact.phone}
                          onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                          className="h-10"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSave("phone", editedContact.phone)}>
                            <Save className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{editedContact.phone}</span>
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0" onClick={() => setIsEditing("phone")}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Department */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{editedContact.department}</span>
                  </div>

                  {/* Seniority */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Briefcase className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{seniorityConfig[editedContact.seniority]}</span>
                  </div>

                  {/* Location */}
                  {editedContact.location && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{editedContact.location}</span>
                    </div>
                  )}

                  {/* LinkedIn */}
                  {editedContact.linkedIn && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <Linkedin className="w-5 h-5 text-muted-foreground shrink-0" />
                      <a href={editedContact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                        View LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Engagement & Ownership Section */}
            <AccordionItem value="engagement" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-semibold">Engagement & Ownership</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-5">
                  {/* Engagement Score */}
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Engagement Score</span>
                      <span className="font-bold text-lg">{editedContact.engagementScore}/100</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all rounded-full"
                        style={{ width: `${editedContact.engagementScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Last Contact */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <Calendar className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground block">Last Contact</span>
                      <span className="text-sm font-medium">{editedContact.lastContact}</span>
                    </div>
                  </div>

                  {/* Next Follow-up */}
                  {editedContact.nextFollowUp && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block">Next Follow-up</span>
                        <span className="text-sm font-medium">{editedContact.nextFollowUp}</span>
                      </div>
                    </div>
                  )}

                  {/* Owner */}
                  {editedContact.contactOwner && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <User className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <span className="text-xs text-muted-foreground block">Contact Owner</span>
                        <span className="text-sm font-medium">{editedContact.contactOwner}</span>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notes Section */}
            <AccordionItem value="notes" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <span className="font-semibold">Notes</span>
                  <Badge variant="secondary" className="ml-2">{mockNotes.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-4">
                  {/* Search & Add */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search notes..."
                        value={noteSearchQuery}
                        onChange={(e) => setNoteSearchQuery(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                    <Button onClick={() => setIsAddingNote(true)} disabled={isAddingNote}>
                      <Plus className="w-4 h-4 mr-2" /> Add Note
                    </Button>
                  </div>

                  {/* Add Note Form */}
                  {isAddingNote && (
                    <div className="p-4 rounded-lg bg-muted/50 space-y-4 animate-fade-in">
                      <Textarea
                        placeholder="Type your note here..."
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="min-h-[120px] text-base leading-relaxed resize-y"
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <Button onClick={handleAddNote}>
                          <Save className="w-4 h-4 mr-2" /> Save Note
                        </Button>
                        <Button variant="ghost" onClick={() => { setIsAddingNote(false); setNewNoteContent(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Notes List */}
                  <div className="space-y-3">
                    {sortedNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {noteSearchQuery ? "No notes found" : "No notes yet. Add your first note above."}
                      </p>
                    ) : (
                      sortedNotes.map((note) => (
                        <div key={note.id} className="p-4 rounded-lg bg-muted/30 space-y-3">
                          {editingNoteId === note.id ? (
                            <div className="space-y-4">
                              <Textarea
                                value={editNoteContent}
                                onChange={(e) => setEditNoteContent(e.target.value)}
                                className="min-h-[120px] text-base leading-relaxed resize-y"
                                autoFocus
                              />
                              <div className="flex gap-3">
                                <Button onClick={() => handleEditNote(note.id)}>
                                  <Save className="w-4 h-4 mr-2" /> Save
                                </Button>
                                <Button variant="ghost" onClick={() => { setEditingNoteId(null); setEditNoteContent(""); }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium">{note.author}</span>
                                  {note.pinned && (
                                    <Badge variant="secondary" className="h-6 px-2">
                                      <Pin className="w-3 h-3 mr-1 fill-current" /> Pinned
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{note.date}</span>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handlePinNote(note.id)}>
                                    <Pin className={`w-4 h-4 ${note.pinned ? 'fill-current' : ''}`} />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{note.content}</p>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Activity Timeline Section */}
            <AccordionItem value="activity" className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <ActivityIcon className="w-5 h-5" />
                  <span className="font-semibold">Activity Timeline</span>
                  <Badge variant="secondary" className="ml-2">{mockActivities.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-1">
                  {mockActivities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-4 py-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          {getActivityIcon(activity.type)}
                        </div>
                        {index < mockActivities.length - 1 && (
                          <div className="w-px h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">{activity.type.replace("-", " ")}</span>
                          <span className="text-xs text-muted-foreground">{activity.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{activity.description}</p>
                        {activity.metadata && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 space-y-3">
        <Button className="w-full h-11">
          <Mail className="w-4 h-4 mr-2" /> Send Email
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-10">
            <Phone className="w-4 h-4 mr-2" /> Call
          </Button>
          <Button variant="outline" className="h-10">
            <Calendar className="w-4 h-4 mr-2" /> Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};
