import { useState, useEffect } from "react";
import { Contact, Note, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceInput } from "./VoiceInput";
import { useDraggable } from "@/hooks/use-draggable";
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
  Search,
  ChevronDown,
  ChevronRight,
  Focus,
  Camera,
  CreditCard,
  Network,
  GripHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface SectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: number;
  isOpen: boolean;
  isFocused: boolean;
  onToggle: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}

const Section = ({ id, title, icon, badge, isOpen, isFocused, onToggle, onFocus, children }: SectionProps) => {
  return (
    <div 
      className={cn(
        "rounded-xl border transition-all duration-300",
        isOpen ? "border-primary/30 bg-card shadow-sm" : "border-border bg-background hover:border-primary/20",
        isFocused && "flex-1 min-h-[400px]"
      )}
    >
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>
          <span className={cn("font-semibold text-base", isOpen && "text-primary")}>{title}</span>
          {badge !== undefined && (
            <Badge variant="secondary" className="ml-1">{badge}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              title={isFocused ? "Exit focus mode" : "Focus on this section"}
            >
              <Focus className={cn("w-4 h-4", isFocused && "text-primary")} />
            </Button>
          )}
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Section Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn(
          "px-6 pb-6 space-y-5",
          isFocused && "min-h-[300px]"
        )}>
          {children}
        </div>
      </div>
    </div>
  );
};

export const ContactDetailPanel = ({ 
  contact, 
  onClose, 
  isExpanded = false, 
  onExpandToggle,
  onUnsavedChanges 
}: ContactDetailPanelProps) => {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedContact, setEditedContact] = useState(contact);
  const [openSection, setOpenSection] = useState<string | null>("ai-insights");
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  
  // Notes state
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  // Draggable functionality for floating mode
  const { position, setPosition, isDragging, dragRef, dragHandleProps } = useDraggable({
    initialPosition: { x: window.innerWidth - 920, y: 100 },
    bounds: "viewport",
  });

  // Reset position when contact changes
  useEffect(() => {
    if (!isExpanded) {
      setPosition({ x: window.innerWidth - 920, y: 100 });
    }
  }, [contact?.id, isExpanded, setPosition]);

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
    setOpenSection("notes");
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

  const toggleSection = (sectionId: string) => {
    if (focusedSection) {
      setFocusedSection(null);
    }
    setOpenSection(openSection === sectionId ? null : sectionId);
  };

  const toggleFocus = (sectionId: string) => {
    if (focusedSection === sectionId) {
      setFocusedSection(null);
    } else {
      setFocusedSection(sectionId);
      setOpenSection(sectionId);
    }
  };

  // Editable Field Component
  const EditableField = ({ 
    field, 
    value, 
    icon, 
    type = "text",
    label 
  }: { 
    field: string; 
    value: string; 
    icon: React.ReactNode; 
    type?: string;
    label?: string;
  }) => {
    const isFieldEditing = isEditing === field;

    return (
      <div className={cn(
        "group rounded-xl transition-all duration-200",
        isFieldEditing ? "bg-muted p-5" : "bg-muted/40 p-4 hover:bg-muted/60"
      )}>
        {label && (
          <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">{label}</span>
        )}
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-background/50 text-muted-foreground shrink-0 mt-0.5">
            {icon}
          </div>
          {isFieldEditing ? (
            <div className="flex-1 space-y-4">
              <Input
                type={type}
                value={(editedContact as any)[field]}
                onChange={(e) => setEditedContact({ ...editedContact, [field]: e.target.value })}
                className="h-12 text-base"
                autoFocus
              />
              <div className="flex gap-3">
                <Button onClick={() => handleSave(field, (editedContact as any)[field])} className="h-10">
                  <Save className="w-4 h-4 mr-2" /> Save
                </Button>
                <Button variant="ghost" onClick={() => setIsEditing(null)} className="h-10">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between min-h-[32px]">
              {field === "email" ? (
                <a href={`mailto:${value}`} className="text-primary hover:underline text-base">{value}</a>
              ) : field === "linkedIn" ? (
                <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-base">
                  View LinkedIn Profile
                </a>
              ) : (
                <span className="text-base">{value}</span>
              )}
              <Button 
                size="icon" 
                variant="ghost" 
                className="opacity-0 group-hover:opacity-100 h-9 w-9" 
                onClick={() => setIsEditing(field)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Display-only Field Component
  const DisplayField = ({ 
    value, 
    icon, 
    label 
  }: { 
    value: string; 
    icon: React.ReactNode; 
    label?: string;
  }) => (
    <div className="rounded-xl bg-muted/40 p-4">
      {label && (
        <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">{label}</span>
      )}
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-background/50 text-muted-foreground shrink-0">
          {icon}
        </div>
        <span className="text-base">{value}</span>
      </div>
    </div>
  );

  return (
    <div 
      ref={!isExpanded ? dragRef : undefined}
      className={cn(
        "flex flex-col bg-background pointer-events-auto",
        isExpanded 
          ? "fixed inset-4 z-50 rounded-2xl shadow-2xl border border-border animate-scale-in" 
          : "fixed z-[9999] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-border min-w-[740px] w-[880px] max-w-[960px] max-h-[calc(100vh-140px)]"
      )}
      style={!isExpanded ? {
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      } : undefined}
    >
      {/* Drag Handle Bar - Only visible in floating mode */}
      {!isExpanded && (
        <div 
          {...dragHandleProps}
          className="flex items-center justify-center py-2 bg-muted/50 rounded-t-2xl border-b border-border/50 hover:bg-muted/70 transition-colors"
        >
          <GripHorizontal className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      
      {/* Panel Header with Title */}
      <div className={cn(
        "sticky top-0 z-10 bg-background border-b border-border",
        isExpanded && "rounded-t-2xl"
      )}>
        {/* Panel Title Bar */}
        <div className={cn(
          "flex items-center justify-between px-6 py-3 bg-muted/30",
          isExpanded && "rounded-t-2xl"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Contact Details</h3>
              <p className="text-xs text-muted-foreground">View and manage contact information</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExpandToggle && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExpandToggle}
                className="gap-2"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {isExpanded ? "Exit Full Screen" : "Full Screen"}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Quick Actions Bar */}
        {/* Quick Capture Tools, Actions & Expand Button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            {/* Capture Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Camera className="w-4 h-4" />
                  Capture
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => document.getElementById('photo-capture-trigger')?.click()}>
                  <User className="w-4 h-4 mr-2" />
                  Contact Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => document.getElementById('photo-capture-trigger')?.click()}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Business Card
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setIsAddingNote(true); setOpenSection("notes"); }}>
                  <FileText className="w-4 h-4 mr-2" />
                  Notes
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Network className="w-4 h-4 mr-2" />
                  Org Chart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <VoiceInput onTranscriptComplete={handleVoiceTranscript} />
            
            {/* Hidden PhotoCapture trigger */}
            <div className="hidden">
              <PhotoCapture onDataExtracted={handlePhotoDataExtracted} />
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            {/* Action Buttons */}
            <Button variant="outline" size="sm" className="gap-2">
              <Phone className="w-4 h-4" />
              Call
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </Button>
          </div>
        </div>

        {/* Profile Header */}
        <div className="px-6 py-6">
          <div className="flex items-start gap-5">
            <Avatar className="w-20 h-20 shrink-0 ring-2 ring-primary/20">
              <AvatarImage src={editedContact.profilePhoto} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                {getInitials(editedContact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-3">
              {/* Name */}
              {isEditing === "name" ? (
                <div className="space-y-3">
                  <Input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="text-xl font-bold h-12"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <Button onClick={() => handleSave("name", editedContact.name)} className="h-10">
                      <Save className="w-4 h-4 mr-2" /> Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditing(null)} className="h-10">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-3">
                  <h2 className="text-2xl font-bold truncate">{editedContact.name}</h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-8 w-8"
                    onClick={() => setIsEditing("name")}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {/* Title */}
              {isEditing === "title" ? (
                <div className="space-y-3">
                  <Input
                    value={editedContact.title}
                    onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                    className="h-10"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <Button onClick={() => handleSave("title", editedContact.title)} className="h-10">
                      <Save className="w-4 h-4 mr-2" /> Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditing(null)} className="h-10">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <p className="text-base text-muted-foreground truncate">{editedContact.title}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-7 w-7"
                    onClick={() => setIsEditing("title")}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Status & Role Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge className={cn(statusInfo.color, "text-sm px-3 py-1")}>{statusInfo.label}</Badge>
                {editedContact.role && (
                  <Badge variant="outline" className="text-sm px-3 py-1">{roleConfig[editedContact.role]}</Badge>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {editedContact.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1.5 text-sm px-3 py-1">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <Select onValueChange={handleAddTag}>
                  <SelectTrigger className="h-8 w-32 text-sm border-dashed">
                    <SelectValue placeholder="+ Add tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedTags
                      .filter(tag => !editedContact.tags?.includes(tag))
                      .map((tag) => (
                        <SelectItem key={tag} value={tag} className="text-sm">{tag}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single Scrollable Content Area - NO NESTED SCROLLBARS */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn(
          "px-6 py-6 space-y-4",
          focusedSection && "flex flex-col"
        )}>
          {/* AI Insights Section */}
          {(!focusedSection || focusedSection === "ai-insights") && (
            <Section
              id="ai-insights"
              title="AI Insights"
              icon={<Sparkles className="w-5 h-5" />}
              isOpen={openSection === "ai-insights"}
              isFocused={focusedSection === "ai-insights"}
              onToggle={() => toggleSection("ai-insights")}
              onFocus={() => toggleFocus("ai-insights")}
            >
              <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <p className="text-base leading-relaxed text-foreground mb-4">
                  High engagement contact with strong buying signals. Recommended next action: Schedule technical deep-dive within 7 days.
                </p>
                <div className="flex items-center gap-3 text-base text-primary font-medium">
                  <TrendingUp className="w-5 h-5" />
                  <span>Engagement trending upward</span>
                </div>
              </div>
            </Section>
          )}

          {/* Contact Information Section */}
          {(!focusedSection || focusedSection === "contact-info") && (
            <Section
              id="contact-info"
              title="Contact Information"
              icon={<User className="w-5 h-5" />}
              isOpen={openSection === "contact-info"}
              isFocused={focusedSection === "contact-info"}
              onToggle={() => toggleSection("contact-info")}
              onFocus={() => toggleFocus("contact-info")}
            >
              <div className="space-y-4">
                <EditableField field="email" value={editedContact.email} icon={<Mail className="w-5 h-5" />} type="email" />
                <EditableField field="phone" value={editedContact.phone} icon={<Phone className="w-5 h-5" />} type="tel" />
                <DisplayField value={editedContact.department} icon={<Building2 className="w-5 h-5" />} label="Department" />
                <DisplayField value={seniorityConfig[editedContact.seniority]} icon={<Briefcase className="w-5 h-5" />} label="Seniority" />
                {editedContact.location && (
                  <DisplayField value={editedContact.location} icon={<MapPin className="w-5 h-5" />} label="Location" />
                )}
                {editedContact.linkedIn && (
                  <EditableField field="linkedIn" value={editedContact.linkedIn} icon={<Linkedin className="w-5 h-5" />} />
                )}
              </div>
            </Section>
          )}

          {/* Engagement & Ownership Section */}
          {(!focusedSection || focusedSection === "engagement") && (
            <Section
              id="engagement"
              title="Engagement & Ownership"
              icon={<TrendingUp className="w-5 h-5" />}
              isOpen={openSection === "engagement"}
              isFocused={focusedSection === "engagement"}
              onToggle={() => toggleSection("engagement")}
              onFocus={() => toggleFocus("engagement")}
            >
              <div className="space-y-5">
                {/* Engagement Score */}
                <div className="p-5 rounded-xl bg-muted/40">
                  <div className="flex justify-between text-base mb-4">
                    <span className="text-muted-foreground font-medium">Engagement Score</span>
                    <span className="font-bold text-2xl text-primary">{editedContact.engagementScore}/100</span>
                  </div>
                  <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all rounded-full"
                      style={{ width: `${editedContact.engagementScore}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-xl bg-muted/40 p-4">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Last Contact</span>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-background/50 text-muted-foreground">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <span className="text-base font-medium">{editedContact.lastContact}</span>
                    </div>
                  </div>

                  {editedContact.nextFollowUp && (
                    <div className="rounded-xl bg-muted/40 p-4">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Next Follow-up</span>
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-background/50 text-muted-foreground">
                          <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium">{editedContact.nextFollowUp}</span>
                      </div>
                    </div>
                  )}

                  {editedContact.contactOwner && (
                    <div className="rounded-xl bg-muted/40 p-4">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-2">Contact Owner</span>
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-background/50 text-muted-foreground">
                          <User className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium">{editedContact.contactOwner}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Notes Section */}
          {(!focusedSection || focusedSection === "notes") && (
            <Section
              id="notes"
              title="Notes"
              icon={<FileText className="w-5 h-5" />}
              badge={mockNotes.length}
              isOpen={openSection === "notes"}
              isFocused={focusedSection === "notes"}
              onToggle={() => toggleSection("notes")}
              onFocus={() => toggleFocus("notes")}
            >
              <div className="space-y-5">
                {/* Search & Add */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="Search notes..."
                      value={noteSearchQuery}
                      onChange={(e) => setNoteSearchQuery(e.target.value)}
                      className="pl-12 h-12 text-base"
                    />
                  </div>
                  <Button onClick={() => setIsAddingNote(true)} disabled={isAddingNote} className="h-12 px-5">
                    <Plus className="w-5 h-5 mr-2" /> Add Note
                  </Button>
                </div>

                {/* Add Note Form - FULL WIDTH */}
                {isAddingNote && (
                  <div className="p-6 rounded-xl bg-muted/50 space-y-5 animate-fade-in">
                    <Textarea
                      placeholder="Type your note here..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[180px] text-base leading-relaxed resize-y p-4"
                      autoFocus
                    />
                    <div className="flex gap-4">
                      <Button onClick={handleAddNote} className="h-11 px-6">
                        <Save className="w-4 h-4 mr-2" /> Save Note
                      </Button>
                      <Button variant="ghost" onClick={() => { setIsAddingNote(false); setNewNoteContent(""); }} className="h-11">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Notes List - FULL WIDTH CARDS */}
                <div className="space-y-4">
                  {sortedNotes.length === 0 ? (
                    <div className="text-center py-12 rounded-xl bg-muted/30">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-base text-muted-foreground">
                        {noteSearchQuery ? "No notes found" : "No notes yet. Add your first note above."}
                      </p>
                    </div>
                  ) : (
                    sortedNotes.map((note) => (
                      <div key={note.id} className="p-5 rounded-xl bg-muted/40 space-y-4">
                        {editingNoteId === note.id ? (
                          <div className="space-y-5">
                            <Textarea
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              className="min-h-[180px] text-base leading-relaxed resize-y p-4"
                              autoFocus
                            />
                            <div className="flex gap-4">
                              <Button onClick={() => handleEditNote(note.id)} className="h-11 px-6">
                                <Save className="w-4 h-4 mr-2" /> Save
                              </Button>
                              <Button variant="ghost" onClick={() => { setEditingNoteId(null); setEditNoteContent(""); }} className="h-11">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-base font-semibold">{note.author}</span>
                                {note.pinned && (
                                  <Badge variant="secondary" className="h-7 px-3">
                                    <Pin className="w-3 h-3 mr-1.5 fill-current" /> Pinned
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">{note.date}</span>
                                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => handlePinNote(note.id)}>
                                  <Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">{note.content}</p>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Activity Timeline Section */}
          {(!focusedSection || focusedSection === "activity") && (
            <Section
              id="activity"
              title="Activity Timeline"
              icon={<ActivityIcon className="w-5 h-5" />}
              badge={mockActivities.length}
              isOpen={openSection === "activity"}
              isFocused={focusedSection === "activity"}
              onToggle={() => toggleSection("activity")}
              onFocus={() => toggleFocus("activity")}
            >
              <div className="space-y-1">
                {mockActivities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-5 py-5">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {getActivityIcon(activity.type)}
                      </div>
                      {index < mockActivities.length - 1 && (
                        <div className="w-px h-full bg-border mt-3" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-semibold capitalize">{activity.type.replace("-", " ")}</span>
                        <span className="text-sm text-muted-foreground">{activity.date}</span>
                      </div>
                      <p className="text-base text-muted-foreground leading-relaxed">{activity.description}</p>
                      {activity.metadata && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {Object.entries(activity.metadata).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-sm">
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

    </div>
  );
};
