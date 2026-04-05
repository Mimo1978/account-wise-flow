import { useState, useEffect } from "react";
import { Contact, Note, Activity, NoteVisibility } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PhotoCapture } from "./PhotoCapture";
import { VoiceInput } from "./VoiceInput";
import { CallActionModal } from "./CallActionModal";
import { EmailActionModal } from "./EmailActionModal";
import { ScheduleActionModal } from "./ScheduleActionModal";
import { OwnershipSection } from "./OwnershipSection";
import { AuditHistorySection } from "@/components/audit/AuditHistorySection";
import { RequestAccessModal } from "@/components/access/RequestAccessModal";
import { useDraggable } from "@/hooks/use-draggable";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
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
  GripHorizontal,
  Lock,
  Globe,
  Users,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  readOnly?: boolean;
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
  onUnsavedChanges,
  readOnly = false
}: ContactDetailPanelProps) => {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedContact, setEditedContact] = useState(contact);
  const [openSection, setOpenSection] = useState<string>("notes");

  
  // Permissions
  const { role, canEdit, isLoading: permissionsLoading } = usePermissions();
  const editTooltip = getPermissionTooltip("edit", role);
  
  // Notes state
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteVisibility, setNewNoteVisibility] = useState<NoteVisibility>("team");
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

  const statusInfo = statusConfig[editedContact.status as keyof typeof statusConfig] || statusConfig.unknown;

  const { data: realNotes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["contact-notes-panel", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("entity_type", "contact")
        .eq("entity_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((n: any) => ({
        id: n.id,
        date: n.created_at,
        author: n.owner_id || "Unknown",
        content: n.content || "",
        pinned: n.pinned || false,
        visibility: n.visibility || "team",
      }));
    },
    enabled: !!contact?.id,
  });

  const { data: realActivities = [] } = useQuery({
    queryKey: ["contact-activities-panel", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data, error } = await (supabase
        .from("contact_activities" as any))
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return (data || []).map((a: any) => ({
        id: a.id,
        type: a.type || "note",
        date: a.created_at,
        description: a.description || a.content || "",
      }));
    },
    enabled: !!contact?.id,
  });

  const filteredNotes = realNotes.filter((note: any) => 
    note.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
    note.author.toLowerCase().includes(noteSearchQuery.toLowerCase())
  );

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const qc = useQueryClient();

  const handleStatusChange = async (newStatus: string) => {
    if (!contact?.id) return;
    setEditedContact({ ...editedContact, status: newStatus as any });
    const { error } = await supabase
      .from("contacts" as any)
      .update({ status: newStatus })
      .eq("id", contact.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      // Invalidate canvas so the org chart dot updates immediately
      qc.invalidateQueries({ queryKey: ['canvas-company'], exact: false });
    }
  };

  const handleSave = (field: string, value: any) => {
    setEditedContact({ ...editedContact, [field]: value });
    setIsEditing(null);
    toast.success("Updated successfully");
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    if (!contact?.id) return;
    const { error } = await supabase.from("notes").insert({
      entity_type: "contact",
      entity_id: contact.id,
      content: newNoteContent,
      visibility: newNoteVisibility,
    });
    if (error) { toast.error("Failed to save note"); return; }
    refetchNotes();
    setNewNoteContent("");
    setNewNoteVisibility("team");
    setIsAddingNote(false);
    toast.success("Note saved");
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

  const handleVoiceTranscript = (transcript: string, noteType: string) => {
    const prefix = noteType === "meeting" ? "[Meeting Notes] " 
      : noteType === "call" ? "[Call Notes] " 
      : noteType === "reminder" ? "[Reminder] " 
      : "";
    setNewNoteContent(prefix + transcript);
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

    // If user can't edit, show locked field
    if (!canEdit) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "rounded-xl transition-all duration-200 bg-muted/40 p-4 cursor-not-allowed opacity-80"
            )}>
              {label && (
                <span className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">{label}</span>
              )}
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-background/50 text-muted-foreground shrink-0 mt-0.5">
                  {icon}
                </div>
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
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{editTooltip || "You don't have permission to edit"}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

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
          : "fixed z-[9999] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-border"
      )}
      style={!isExpanded ? {
        left: position.x,
        top: position.y,
        width: 'clamp(720px, 75vw, 1080px)',
        height: 'clamp(560px, 80vh, 860px)',
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
      
      {/* Action Bar */}
      <div className={cn(
        "sticky top-0 z-10 bg-background",
        isExpanded && "rounded-t-2xl"
      )}>
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/50">
          <Button size="sm" className="gap-1.5 h-8" onClick={() => { setIsAddingNote(true); setOpenSection("notes"); }}>
            <FileText className="w-3.5 h-3.5" /> Note
          </Button>
          <CallActionModal phone={editedContact.phone} email={editedContact.email} contactName={editedContact.name}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Phone className="w-3.5 h-3.5" /> Call
            </Button>
          </CallActionModal>
          <EmailActionModal email={editedContact.email} phone={editedContact.phone} contactName={editedContact.name}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>
          </EmailActionModal>
          <ScheduleActionModal email={editedContact.email} contactName={editedContact.name}>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </Button>
          </ScheduleActionModal>
          <VoiceInput onTranscriptComplete={handleVoiceTranscript} />

          {/* Hidden PhotoCapture trigger */}
          <div className="hidden">
            <PhotoCapture onDataExtracted={handlePhotoDataExtracted} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!canEdit && editedContact.id && (
              <RequestAccessModal
                entityType="contact"
                entityId={editedContact.id}
                entityName={editedContact.name}
              />
            )}
            {editedContact.lastContact && (
              <span className="text-xs text-muted-foreground">
                Last contact: {editedContact.lastContact}
              </span>
            )}
            {onExpandToggle && (
              <Button variant="ghost" size="icon" onClick={onExpandToggle} className="h-8 w-8">
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Header - Compact in Fullscreen, Expanded in Normal */}
        {isExpanded ? (
          /* Fullscreen: Single-line compact header */
          <div className="px-6 py-3 border-b border-border/50">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10 shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={editedContact.profilePhoto} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {getInitials(editedContact.name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Name - Editable */}
              {isEditing === "name" ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="text-lg font-bold h-9 w-48"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => handleSave("name", editedContact.name)} className="h-8">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)} className="h-8">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button 
                  className="group flex items-center gap-1 hover:text-primary transition-colors"
                  onClick={() => setIsEditing("name")}
                >
                  <span className="text-lg font-bold">{editedContact.name}</span>
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <span className="text-muted-foreground">•</span>
              
              {/* Title - Editable */}
              {isEditing === "title" ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedContact.title}
                    onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                    className="h-8 w-40 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={() => handleSave("title", editedContact.title)} className="h-7">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)} className="h-7">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button 
                  className="group flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsEditing("title")}
                >
                  <span className="text-sm">{editedContact.title}</span>
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <span className="text-muted-foreground">•</span>
              
              {/* Status Badge */}
              <Badge className={cn(statusInfo.color, "text-xs px-2 py-0.5")}>{statusInfo.label}</Badge>
              
              {/* Role Badge */}
              {editedContact.role && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">{roleConfig[editedContact.role]}</Badge>
              )}

              {/* Status Quick-Change — tap to update org chart dot instantly */}
              <div className="flex items-center gap-1.5 ml-auto">
                {[
                  { key: "champion", color: "bg-node-champion", label: "Champion" },
                  { key: "engaged", color: "bg-node-engaged", label: "Engaged" },
                  { key: "warm", color: "bg-node-warm", label: "Warm" },
                  { key: "unknown", color: "bg-node-unknown", label: "Unknown" },
                  { key: "blocker", color: "bg-node-blocker", label: "Blocker" },
                ].map(({ key, color, label }) => (
                  <button
                    key={key}
                    title={label}
                    onClick={() => handleStatusChange(key)}
                    className={`w-5 h-5 rounded-full transition-all ${color} ${
                      editedContact.status === key
                        ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-125"
                        : "opacity-50 hover:opacity-100 hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Normal mode: Full header */
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

                {/* Relationship Status — one tap updates org chart dot */}
                <div className="pt-2 space-y-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Relationship:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: "champion", color: "bg-node-champion", label: "Champion" },
                      { key: "engaged", color: "bg-node-engaged", label: "Engaged" },
                      { key: "warm", color: "bg-node-warm", label: "Warm" },
                      { key: "unknown", color: "bg-node-unknown", label: "Unknown" },
                      { key: "blocker", color: "bg-node-blocker", label: "Blocker" },
                    ].map(({ key, color, label }) => (
                      <button
                        key={key}
                        onClick={() => handleStatusChange(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          editedContact.status === key
                            ? `${color} text-white border-transparent shadow-md scale-105`
                            : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Next Action — the feature CRMs get wrong */}
                <div className="pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Next Action</span>
                    {editedContact.lastContact && (
                      <span className="text-xs text-muted-foreground">
                        Last contact: {editedContact.lastContact}
                      </span>
                    )}
                  </div>
                  {isEditing === "nextAction" ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Send proposal by Friday"
                        value={(editedContact as any).nextAction || ""}
                        onChange={(e) => setEditedContact({ ...editedContact, nextAction: e.target.value } as any)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleSave("nextAction", (editedContact as any).nextAction)} className="h-8 px-3">
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)} className="h-8">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing("nextAction")}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {(editedContact as any).nextAction || "+ Add next action..."}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two-column body layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: static fields sidebar - 240px fixed width */}
        <div className="w-60 shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
          {/* Contact Information */}
          <div className="space-y-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Contact Info</span>
            <EditableField field="email" value={editedContact.email} icon={<Mail className="w-4 h-4" />} type="email" />
            <EditableField field="phone" value={editedContact.phone} icon={<Phone className="w-4 h-4" />} type="tel" />
            <DisplayField value={editedContact.department} icon={<Building2 className="w-4 h-4" />} label="Department" />
            <DisplayField value={seniorityConfig[editedContact.seniority]} icon={<Briefcase className="w-4 h-4" />} label="Seniority" />
            {editedContact.location && (
              <DisplayField value={editedContact.location} icon={<MapPin className="w-4 h-4" />} label="Location" />
            )}
            {editedContact.linkedIn && (
              <EditableField field="linkedIn" value={editedContact.linkedIn} icon={<Linkedin className="w-4 h-4" />} />
            )}
          </div>

          {/* Engagement & Ownership */}
          <div className="space-y-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Engagement</span>
            <OwnershipSection
              entityType="contact"
              entityId={editedContact.id}
              ownerId={null}
              teamMembers={[]}
              onOwnerChange={(newOwnerId) => {
                console.log("Owner changed:", newOwnerId);
              }}
              onTeamChange={(newTeam) => {
                console.log("Team changed:", newTeam);
              }}
            />

            <AuditHistorySection
              entityType="contacts"
              entityId={editedContact.id}
            />

            {/* Engagement Score */}
            <div className="p-4 rounded-xl bg-muted/40">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-muted-foreground font-medium">Engagement Score</span>
                <span className="font-bold text-xl text-primary">{editedContact.engagementScore}/100</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all rounded-full"
                  style={{ width: `${editedContact.engagementScore}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Last Contact</span>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-background/50 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{editedContact.lastContact}</span>
                </div>
              </div>

              {editedContact.nextFollowUp && (
                <div className="rounded-xl bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Next Follow-up</span>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-background/50 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">{editedContact.nextFollowUp}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: tabbed workspace - flex-1 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar - sticky */}
          <div className="border-b border-border px-4">
            <div className="flex gap-1">
              {["notes", "activity", "details", "ai-insights"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setOpenSection(tab)}
                  className={cn(
                    "h-9 px-3 text-xs capitalize border-b-2 transition-colors",
                    openSection === tab
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content - scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            {openSection === "notes" && (
              <div className="space-y-4">
                {/* Search & Add */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search notes..."
                      value={noteSearchQuery}
                      onChange={(e) => setNoteSearchQuery(e.target.value)}
                      className="pl-10 h-10 text-sm"
                    />
                  </div>
                  <Button onClick={() => setIsAddingNote(true)} disabled={isAddingNote} size="sm" className="h-10 px-4">
                    <Plus className="w-4 h-4 mr-1.5" /> Add
                  </Button>
                </div>

                {/* Add Note Form */}
                {isAddingNote && (
                  <div className="p-4 rounded-xl bg-muted/50 space-y-4 animate-fade-in">
                    <Textarea
                      placeholder="Type your note here..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[120px] text-sm leading-relaxed resize-y p-3"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Visibility:</span>
                        <Select value={newNoteVisibility} onValueChange={(v) => setNewNoteVisibility(v as NoteVisibility)}>
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public" className="text-xs">
                              <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3" />
                                <span>Public</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="team" className="text-xs">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3" />
                                <span>Team</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="private" className="text-xs">
                              <div className="flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                <span>Private</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-3">
                        <Button onClick={handleAddNote} size="sm" className="h-9 px-4">
                          <Save className="w-3 h-3 mr-1.5" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setIsAddingNote(false); setNewNoteContent(""); setNewNoteVisibility("team"); }} className="h-9">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes List */}
                <div className="space-y-3">
                  {sortedNotes.length === 0 ? (
                    <div className="text-center py-8 rounded-xl bg-muted/30">
                      <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {noteSearchQuery ? "No notes found" : "No notes yet"}
                      </p>
                    </div>
                  ) : (
                    sortedNotes.map((note) => (
                      <div key={note.id} className={cn(
                        "p-4 rounded-xl space-y-3",
                        (note as any).isRedacted ? "bg-muted/20 border border-dashed border-muted-foreground/30" : "bg-muted/40"
                      )}>
                        {(note as any).isRedacted ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <EyeOff className="w-4 h-4" />
                              <span className="text-sm italic">Private note — request access</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{note.date}</span>
                              <Badge variant="outline" className="h-5 px-2 text-xs text-muted-foreground">
                                <Lock className="w-2.5 h-2.5 mr-1" /> Private
                              </Badge>
                            </div>
                          </div>
                        ) : editingNoteId === note.id ? (
                          <div className="space-y-4">
                            <Textarea
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              className="min-h-[120px] text-sm leading-relaxed resize-y p-3"
                              autoFocus
                            />
                            <div className="flex gap-3">
                              <Button onClick={() => handleEditNote(note.id)} size="sm" className="h-9 px-4">
                                <Save className="w-3 h-3 mr-1.5" /> Save
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setEditingNoteId(null); setEditNoteContent(""); }} className="h-9">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{note.author}</span>
                                {note.pinned && (
                                  <Badge variant="secondary" className="h-5 px-2 text-xs">
                                    <Pin className="w-2.5 h-2.5 mr-1 fill-current" /> Pinned
                                  </Badge>
                                )}
                                {note.visibility && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "h-5 px-2 text-xs",
                                      note.visibility === "public" && "text-green-600 border-green-600/30",
                                      note.visibility === "team" && "text-blue-600 border-blue-600/30",
                                      note.visibility === "private" && "text-orange-600 border-orange-600/30"
                                    )}
                                  >
                                    {note.visibility === "public" && <Globe className="w-2.5 h-2.5 mr-1" />}
                                    {note.visibility === "team" && <Users className="w-2.5 h-2.5 mr-1" />}
                                    {note.visibility === "private" && <Lock className="w-2.5 h-2.5 mr-1" />}
                                    {note.visibility.charAt(0).toUpperCase() + note.visibility.slice(1)}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{note.date}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePinNote(note.id)}>
                                  <Pin className={cn("w-3 h-3", note.pinned && "fill-current")} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}>
                                  <Edit2 className="w-3 h-3" />
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
            )}

            {openSection === "activity" && (
              <div className="space-y-1">
                {realActivities.map((activity: any, index: number) => (
                  <div key={activity.id} className="flex gap-4 py-3">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {getActivityIcon(activity.type)}
                      </div>
                      {index < realActivities.length - 1 && (
                        <div className="w-px h-full bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold capitalize">{activity.type.replace("-", " ")}</span>
                        <span className="text-xs text-muted-foreground">{activity.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{activity.description}</p>
                      {activity.metadata && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(activity.metadata).map(([key, value]: [string, any]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openSection === "details" && (
              <div className="text-sm text-muted-foreground">Additional details</div>
            )}

            {openSection === "ai-insights" && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <p className="text-sm leading-relaxed text-foreground mb-3">
                  High engagement contact with strong buying signals. Recommended next action: Schedule technical deep-dive within 7 days.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <TrendingUp className="w-4 h-4" />
                  <span>Engagement trending upward</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
