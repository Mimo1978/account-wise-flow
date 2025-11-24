import { useState } from "react";
import { Contact, Note, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesSection } from "./NotesSection";
import { ActivityTimeline } from "./ActivityTimeline";
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
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
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

export const ContactDetailPanel = ({ contact, onClose }: ContactDetailPanelProps) => {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editedContact, setEditedContact] = useState(contact);

  if (!contact || !editedContact) return null;

  const statusInfo = statusConfig[editedContact.status];

  // Mock data for demonstration
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

  const handleSave = (field: string, value: any) => {
    setEditedContact({ ...editedContact, [field]: value });
    setIsEditing(null);
    toast.success("Updated successfully");
  };

  const handleAddNote = (content: string) => {
    // In real app, this would call an API
    console.log("Adding note:", content);
  };

  const handleEditNote = (noteId: string, content: string) => {
    console.log("Editing note:", noteId, content);
  };

  const handlePinNote = (noteId: string) => {
    console.log("Pinning note:", noteId);
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
    // Auto-fill extracted data into contact fields
    setEditedContact({
      ...editedContact,
      name: data.name || editedContact.name,
      email: data.email || editedContact.email,
      title: data.title || editedContact.title,
      phone: data.phone || editedContact.phone,
    });
    
    // Add extraction note
    if (data.note) {
      handleAddNote(`Auto-extracted from photo: ${data.note}`);
    }
    
    toast.success("Contact data extracted and pre-filled");
  };

  const handleVoiceTranscript = (transcript: string) => {
    handleAddNote(transcript);
  };

  return (
    <div className="w-[480px] h-full border-l border-border bg-background flex flex-col animate-slide-in-right">
      {/* Header with Profile */}
      <div className="p-6 border-b border-border space-y-4">
        {/* Quick Capture Tools */}
        <div className="flex items-center gap-2">
          <PhotoCapture onDataExtracted={handlePhotoDataExtracted} />
          <VoiceInput onTranscriptComplete={handleVoiceTranscript} />
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <Avatar className="w-16 h-16">
              <AvatarImage src={editedContact.profilePhoto} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(editedContact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {isEditing === "name" ? (
                <div className="space-y-2">
                  <Input
                    value={editedContact.name}
                    onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                    className="h-8"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave("name", editedContact.name)}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{editedContact.name}</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                    onClick={() => setIsEditing("name")}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {isEditing === "title" ? (
                <div className="space-y-2 mt-2">
                  <Input
                    value={editedContact.title}
                    onChange={(e) => setEditedContact({ ...editedContact, title: e.target.value })}
                    className="h-7 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave("title", editedContact.title)}>
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground truncate">{editedContact.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0"
                    onClick={() => setIsEditing("title")}
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
          {editedContact.role && (
            <Badge variant="outline">
              {roleConfig[editedContact.role]}
            </Badge>
          )}
          {editedContact.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              <Tag className="w-3 h-3" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>

        {/* Add Tag Selector */}
        <Select onValueChange={handleAddTag}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ Add tag" />
          </SelectTrigger>
          <SelectContent>
            {predefinedTags
              .filter(tag => !editedContact.tags?.includes(tag))
              .map((tag) => (
                <SelectItem key={tag} value={tag} className="text-xs">
                  {tag}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* AI Insights Box */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold">AI Insights</span>
            </div>
            <p className="text-sm text-foreground">
              High engagement contact with strong buying signals. Recommended next action: Schedule technical deep-dive within 7 days.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Engagement trending upward</span>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm group">
                <Mail className="w-4 h-4 text-muted-foreground" />
                {isEditing === "email" ? (
                  <Input
                    type="email"
                    value={editedContact.email}
                    onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                    onBlur={() => handleSave("email", editedContact.email)}
                    className="h-7 flex-1"
                    autoFocus
                  />
                ) : (
                  <>
                    <a href={`mailto:${editedContact.email}`} className="text-primary hover:underline flex-1">
                      {editedContact.email}
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={() => setIsEditing("email")}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm group">
                <Phone className="w-4 h-4 text-muted-foreground" />
                {isEditing === "phone" ? (
                  <Input
                    type="tel"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    onBlur={() => handleSave("phone", editedContact.phone)}
                    className="h-7 flex-1"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="flex-1">{editedContact.phone}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={() => setIsEditing("phone")}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{editedContact.department}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span>{seniorityConfig[editedContact.seniority]}</span>
              </div>

              {editedContact.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{editedContact.location}</span>
                </div>
              )}

              {editedContact.linkedIn && (
                <div className="flex items-center gap-3 text-sm">
                  <Linkedin className="w-4 h-4 text-muted-foreground" />
                  <a href={editedContact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* CRM Metadata */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Engagement & Ownership
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Engagement Score</span>
                  <span className="font-semibold">{editedContact.engagementScore}/100</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all"
                    style={{ width: `${editedContact.engagementScore}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Contact:</span>
                <span className="font-medium">{editedContact.lastContact}</span>
              </div>

              {editedContact.nextFollowUp && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next Follow-up:</span>
                  <span className="font-medium">{editedContact.nextFollowUp}</span>
                </div>
              )}

              {editedContact.contactOwner && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{editedContact.contactOwner}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Tabbed Content: Notes & Activity */}
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="mt-4">
              <NotesSection
                notes={mockNotes}
                onAddNote={handleAddNote}
                onEditNote={handleEditNote}
                onPinNote={handlePinNote}
              />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <ActivityTimeline activities={mockActivities} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full">
          <Mail className="w-4 h-4 mr-2" />
          Send Email
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline">
            <Phone className="w-4 h-4 mr-2" />
            Call
          </Button>
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>
    </div>
  );
};
