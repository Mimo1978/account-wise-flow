import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  MessageSquare
} from "lucide-react";

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

const mockEngagementHistory = [
  { date: "2025-01-23", type: "Email", note: "Followed up on product demo feedback" },
  { date: "2025-01-20", type: "Meeting", note: "Product demo - very positive response" },
  { date: "2025-01-15", type: "Call", note: "Initial discovery call" },
  { date: "2025-01-10", type: "Email", note: "Introduction email sent" },
];

const mockNotes = [
  { date: "2025-01-22", author: "Sarah Williams", note: "Key decision maker for infrastructure projects. Mentioned budget approval needed by Q2." },
  { date: "2025-01-18", author: "Michael Chen", note: "Technical requirements align well with our platform. Should involve in next technical workshop." },
];

export const ContactDetailPanel = ({ contact, onClose }: ContactDetailPanelProps) => {
  if (!contact) return null;

  const statusInfo = statusConfig[contact.status];

  return (
    <div className="w-96 h-full border-l border-border bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{contact.name}</h2>
            <p className="text-muted-foreground">{contact.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Badge className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
          {contact.role && (
            <Badge variant="outline">
              {roleConfig[contact.role]}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{contact.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span>{seniorityConfig[contact.seniority]}</span>
              </div>
              {contact.linkedIn && (
                <div className="flex items-center gap-3 text-sm">
                  <Linkedin className="w-4 h-4 text-muted-foreground" />
                  <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Engagement Score */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Engagement Metrics
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Engagement Score</span>
                  <span className="font-semibold">{contact.engagementScore}/100</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${contact.engagementScore}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Contact:</span>
                <span className="font-medium">{contact.lastContact}</span>
              </div>
              {contact.contactOwner && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{contact.contactOwner}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Engagement History */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Engagement History
            </h3>
            <div className="space-y-3">
              {mockEngagementHistory.map((entry, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    {idx < mockEngagementHistory.length - 1 && (
                      <div className="w-px h-full bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {entry.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{entry.date}</span>
                    </div>
                    <p className="text-sm text-foreground">{entry.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </h3>
            <div className="space-y-3">
              {mockNotes.map((note, idx) => (
                <div key={idx} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{note.author}</span>
                    <span className="text-xs text-muted-foreground">{note.date}</span>
                  </div>
                  <p className="text-sm text-foreground">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full">
          <Mail className="w-4 h-4 mr-2" />
          Send Email
        </Button>
        <Button variant="outline" className="w-full">
          <MessageSquare className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>
    </div>
  );
};
