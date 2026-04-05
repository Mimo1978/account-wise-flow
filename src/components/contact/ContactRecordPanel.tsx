import { useState } from "react";
import { Contact, Account } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  X, 
  Building2, 
  Network, 
  Mail, 
  Plus, 
  User,
  FileText,
  Briefcase,
  Lightbulb,
  MessageSquare,
  Phone,
  Calendar,
  Mic
} from "lucide-react";
import { ContactOverviewTab } from "./ContactOverviewTab";
import { ContactNotesTab } from "./ContactNotesTab";
import { ContactDocumentsTab } from "./ContactDocumentsTab";
import { ContactProjectsTab } from "./ContactProjectsTab";
import { ContactInsightsTab } from "./ContactInsightsTab";
import { useNavigate } from "react-router-dom";

interface ContactRecordPanelProps {
  contact: Contact | null;
  companyName: string;
  company?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenCompany?: () => void;
}

const statusConfig = {
  champion: { label: "Champion", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  engaged: { label: "Engaged", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  warm: { label: "Warm", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  new: { label: "New", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  blocker: { label: "Blocker", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
};

export function ContactRecordPanel({
  contact,
  companyName,
  company,
  open,
  onOpenChange,
  onOpenCompany,
}: ContactRecordPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  if (!contact) return null;

  const statusInfo = statusConfig[contact.status] || statusConfig.unknown;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleViewOnCanvas = () => {
    navigate(`/canvas?contact=${contact.id}`);
    onOpenChange(false);
  };

  const handleEmailContact = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Contact Record - {contact.name}</SheetTitle>
        </SheetHeader>

        {/* Header - Always Visible */}
        <div className="border-b border-border bg-card px-6 py-5 shrink-0">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarImage src={contact.profilePhoto} alt={contact.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {contact.name}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.title}
                  </p>
                  <button 
                    onClick={onOpenCompany}
                    className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {companyName}
                  </button>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className={statusInfo.className}>
                  {statusInfo.label}
                </Badge>
                {contact.role && (
                  <Badge variant="secondary" className="text-xs">
                    {contact.role.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                )}
                {contact.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => setActiveTab("notes")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Note
            </Button>
            <Button size="sm" variant="outline" onClick={handleEmailContact} disabled={!contact.email} className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => contact.phone && window.open(`tel:${contact.phone}`)}
              disabled={!contact.phone}
              className="gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </Button>
            <Button size="sm" variant="outline" onClick={handleViewOnCanvas} className="gap-1.5">
              <Network className="h-3.5 w-3.5" /> Canvas
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenCompany} className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Company
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b border-border bg-muted/30 px-6">
            <TabsList className="h-12 bg-transparent gap-4 w-full justify-start">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
              >
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Notes & Activity
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
              >
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger 
                value="projects" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
              >
                <Briefcase className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger 
                value="insights" 
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
              >
                <Lightbulb className="h-4 w-4" />
                Insights
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="overview" className="m-0 p-6 h-full">
              <ContactOverviewTab contact={contact} companyName={companyName} />
            </TabsContent>
            <TabsContent value="notes" className="m-0 p-6 h-full">
              <ContactNotesTab contact={contact} />
            </TabsContent>
            <TabsContent value="documents" className="m-0 p-6 h-full">
              <ContactDocumentsTab contact={contact} />
            </TabsContent>
            <TabsContent value="projects" className="m-0 p-6 h-full">
              <ContactProjectsTab contact={contact} companyName={companyName} />
            </TabsContent>
            <TabsContent value="insights" className="m-0 p-6 h-full">
              <ContactInsightsTab contact={contact} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
