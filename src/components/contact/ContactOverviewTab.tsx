import { Contact } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Linkedin,
  Edit2,
  Sparkles,
  TrendingUp,
  Calendar,
  Users,
  Briefcase,
  UserCheck,
  Target
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ContactOverviewTabProps {
  contact: Contact;
  companyName: string;
}

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

const roleLabels: Record<string, string> = {
  "economic-buyer": "Economic Buyer",
  "technical-evaluator": "Technical Evaluator",
  "champion": "Champion",
  "blocker": "Blocker",
  "influencer": "Influencer",
};

export function ContactOverviewTab({ contact, companyName }: ContactOverviewTabProps) {
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(
    `Key relationship at ${companyName}. ${contact.status === 'champion' ? 'Acts as internal champion for our initiatives.' : contact.status === 'engaged' ? 'Highly engaged and responsive.' : 'Developing relationship with growth potential.'}`
  );

  const handleSaveSummary = () => {
    setIsEditingSummary(false);
    toast.success("Summary updated");
  };

  // Mock commercial context - in real app, this would come from database
  const commercialContext = {
    isClientStakeholder: contact.status === 'champion' || contact.status === 'engaged',
    isCandidate: false,
    isContractor: false,
    isPartner: contact.role === 'influencer',
  };

  return (
    <div className="space-y-6">
      {/* Contact Profile Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Contact Profile
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Full Name</p>
              <p className="text-sm font-medium">{contact.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Job Title</p>
              <p className="text-sm font-medium">{contact.title || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Department</p>
              <p className="text-sm font-medium">{contact.department || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Seniority</p>
              <p className="text-sm font-medium">{seniorityLabels[contact.seniority] || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Company</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {companyName}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Location</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                {contact.location ? (
                  <>
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {contact.location}
                  </>
                ) : "—"}
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="pt-3 border-t border-border space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.linkedIn && (
              <div className="flex items-center gap-2 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  View LinkedIn Profile
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relationship Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Relationship Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Engagement Level</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {contact.status}
                </Badge>
                {contact.engagementScore && (
                  <span className="text-sm text-muted-foreground">
                    {contact.engagementScore}%
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Buying Role</p>
              <p className="text-sm font-medium">
                {contact.role ? roleLabels[contact.role] : "Not assigned"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Internal Owner</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                {contact.contactOwner || "Unassigned"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Contacted</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {contact.lastContact || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commercial Context Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Commercial Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {commercialContext.isClientStakeholder && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                <Target className="h-3 w-3 mr-1" />
                Client Stakeholder
              </Badge>
            )}
            {commercialContext.isCandidate && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                <User className="h-3 w-3 mr-1" />
                Candidate
              </Badge>
            )}
            {commercialContext.isContractor && (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                <Briefcase className="h-3 w-3 mr-1" />
                Contractor Placed
              </Badge>
            )}
            {commercialContext.isPartner && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                <Users className="h-3 w-3 mr-1" />
                Partner
              </Badge>
            )}
            {!commercialContext.isClientStakeholder && !commercialContext.isCandidate && 
             !commercialContext.isContractor && !commercialContext.isPartner && (
              <p className="text-sm text-muted-foreground">No commercial relationship assigned</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Summary
            </CardTitle>
            {!isEditingSummary && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditingSummary(true)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingSummary ? (
            <div className="space-y-3">
              <Textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                className="min-h-[100px]"
                placeholder="Write a brief summary of this relationship..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSummary}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingSummary(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summaryText}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
