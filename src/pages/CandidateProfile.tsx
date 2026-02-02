import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useCandidates } from "@/hooks/use-candidates";
import { usePermissions } from "@/hooks/use-permissions";
import { useCandidateCV } from "@/hooks/use-candidate-cv";
import { Talent, TalentAvailability, TalentStatus, TalentExperience } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  ExternalLink,
  FileText,
  Download,
  Sparkles,
  Briefcase,
  Tags,
  Clock,
  Edit2,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Upload,
  MessageSquare,
  Calendar,
  Target,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CandidateNotesSection } from "@/components/talent/CandidateNotesSection";
import { CandidateInterviewsSection } from "@/components/talent/CandidateInterviewsSection";
import { CandidateOpportunitiesSection } from "@/components/talent/CandidateOpportunitiesSection";
import { CandidateOverviewEditor } from "@/components/talent/CandidateOverviewEditor";
import { CVUploadModal } from "@/components/talent/CVUploadModal";
import { CVDrawerViewer } from "@/components/talent/CVDrawerViewer";

const availabilityColors: Record<TalentAvailability, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  interviewing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  deployed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const availabilityLabels: Record<TalentAvailability, string> = {
  available: "Available",
  interviewing: "Interviewing",
  deployed: "Deployed",
};

const statusColors: Record<TalentStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  new: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "on-hold": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<TalentStatus, string> = {
  active: "Active",
  new: "New",
  "on-hold": "On Hold",
  archived: "Archived",
};

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

// Mock experience for demo
const getMockExperience = (talentId: string): TalentExperience[] => {
  return [
    { id: "e1", company: "Previous Company", title: "Senior Role", startDate: "2021-01", current: true, description: "Current position." },
    { id: "e2", company: "Earlier Company", title: "Mid-Level Role", startDate: "2018-06", endDate: "2020-12", description: "Previous experience." },
  ];
};

export default function CandidateProfile() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { candidates, isLoading, refetch } = useCandidates();
  const { canEdit, isAdmin, isManager, userId } = usePermissions();
  const { downloadCV, isDownloading } = useCandidateCV();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["overview", "skills", "experience", "notes", "interviews", "opportunities"])
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCVViewer, setShowCVViewer] = useState(false);

  const candidate = useMemo(() => {
    return candidates.find((c) => c.id === candidateId) || null;
  }, [candidates, candidateId]);

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Candidate Not Found</h2>
        <p className="text-muted-foreground mb-4">The candidate you're looking for doesn't exist or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate("/talent")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Talent Database
        </Button>
      </div>
    );
  }

  const experience = candidate.experience || getMockExperience(candidate.id);
  const aiOverview = candidate.aiOverview || `${candidate.name} is a ${seniorityLabels[candidate.seniority]?.toLowerCase() || candidate.seniority}-level ${candidate.roleType} with expertise in ${candidate.skills.slice(0, 3).join(", ")}. Currently ${availabilityLabels[candidate.availability].toLowerCase()} for new opportunities.`;

  const getDataQualityBadge = () => {
    if (candidate.dataQuality === "parsed") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Parsed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1">
        <AlertCircle className="h-3 w-3" />
        Needs Review
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-background p-4 lg:p-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/talent")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{candidate.name}</h1>
              <p className="text-muted-foreground">{candidate.roleType}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={cn("font-medium", availabilityColors[candidate.availability])}>
                  {availabilityLabels[candidate.availability]}
                </Badge>
                <Badge className={statusColors[candidate.status]}>
                  {statusLabels[candidate.status]}
                </Badge>
                {getDataQualityBadge()}
                {candidate.rate && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    {candidate.rate}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowUploadModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CV
              </Button>
            )}
            <Button variant="default" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - 2-column layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-6 p-4 lg:p-6 overflow-auto">
          {/* Left Column - Sticky Summary */}
          <div className="lg:sticky lg:top-0 lg:self-start">
            <Card className="mb-6 lg:mb-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">
                    {candidate.email}
                  </a>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{candidate.phone}</span>
                  </div>
                )}
                {candidate.phoneNumbers?.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{phone.value}</span>
                    <Badge variant="outline" className="text-xs">{phone.label}</Badge>
                    {phone.preferred && (
                      <Badge variant="secondary" className="text-xs">Preferred</Badge>
                    )}
                  </div>
                ))}
                {candidate.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{candidate.location}</span>
                  </div>
                )}
                {candidate.linkedIn && (
                  <div className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={candidate.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      LinkedIn
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seniority</span>
                    <span className="font-medium">{seniorityLabels[candidate.seniority] || candidate.seniority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role Type</span>
                    <span className="font-medium">{candidate.roleType}</span>
                  </div>
                  {candidate.lastUpdated && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span className="font-medium">{format(new Date(candidate.lastUpdated), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Add Interview
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Target className="h-4 w-4 mr-2" />
                    Add to Opportunity
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowCVViewer(true)}
                    disabled={!candidate.cvStoragePath}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {candidate.cvStoragePath ? "View CV" : "No CV"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Scrollable Sections */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI Candidate Overview */}
            <CollapsibleSection
              id="overview"
              title="AI Candidate Overview"
              icon={<Sparkles className="h-4 w-4" />}
              expanded={expandedSections.has("overview")}
              onToggle={() => toggleSection("overview")}
            >
              <CandidateOverviewEditor
                candidateId={candidate.id}
                initialOverview={aiOverview}
                canEdit={canEdit}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="cv"
              title="CV & Documents"
              icon={<FileText className="h-4 w-4" />}
              badge={candidate.cvStoragePath ? "1" : undefined}
              expanded={expandedSections.has("cv")}
              onToggle={() => toggleSection("cv")}
            >
              <div className="space-y-4">
                {candidate.cvStoragePath ? (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                      <div className="p-2 rounded bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {candidate.cvStoragePath.split("/").pop() || "CV Document"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.cvStoragePath.endsWith(".pdf") ? "PDF Document" :
                           candidate.cvStoragePath.endsWith(".docx") ? "Word Document" :
                           candidate.cvStoragePath.endsWith(".doc") ? "Word Document" : "Document"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCVViewer(true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View CV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const filename = candidate.cvStoragePath?.split("/").pop() || `${candidate.name}_CV.pdf`;
                          downloadCV(candidate.id, candidate.cvStoragePath!, filename);
                        }}
                        disabled={isDownloading}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {isDownloading ? "Downloading..." : "Download"}
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowUploadModal(true)}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload New
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">No CV uploaded yet</p>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUploadModal(true)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CV
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Skills */}
            <CollapsibleSection
              id="skills"
              title="Skills"
              icon={<Tags className="h-4 w-4" />}
              badge={candidate.skills.length.toString()}
              expanded={expandedSections.has("skills")}
              onToggle={() => toggleSection("skills")}
            >
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </CollapsibleSection>

            {/* Experience Timeline */}
            <CollapsibleSection
              id="experience"
              title="Experience"
              icon={<Briefcase className="h-4 w-4" />}
              badge={experience.length.toString()}
              expanded={expandedSections.has("experience")}
              onToggle={() => toggleSection("experience")}
            >
              <div className="space-y-4">
                {experience.map((exp, idx) => (
                  <div key={exp.id} className="relative">
                    {idx !== experience.length - 1 && (
                      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                    )}
                    <div className="flex gap-4">
                      <div className="relative z-10">
                        <div className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                          exp.current
                            ? "bg-primary border-primary"
                            : "bg-background border-muted-foreground/30"
                        )}>
                          {exp.current && (
                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{exp.title}</h4>
                            <p className="text-sm text-muted-foreground">{exp.company}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDate(exp.startDate)} - {exp.current ? "Present" : formatDate(exp.endDate!)}
                            </span>
                          </div>
                        </div>
                        {exp.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Interviews / Pipeline */}
            <CollapsibleSection
              id="interviews"
              title="Interviews"
              icon={<Calendar className="h-4 w-4" />}
              expanded={expandedSections.has("interviews")}
              onToggle={() => toggleSection("interviews")}
            >
              <CandidateInterviewsSection
                candidateId={candidate.id}
                canEdit={canEdit}
                canDelete={isAdmin || isManager}
              />
            </CollapsibleSection>

            {/* Opportunities */}
            <CollapsibleSection
              id="opportunities"
              title="Projects / Opportunities"
              icon={<Target className="h-4 w-4" />}
              expanded={expandedSections.has("opportunities")}
              onToggle={() => toggleSection("opportunities")}
            >
              <CandidateOpportunitiesSection
                candidateId={candidate.id}
                canEdit={canEdit}
                canDelete={isAdmin || isManager}
              />
            </CollapsibleSection>

            {/* Notes */}
            <CollapsibleSection
              id="notes"
              title="Notes"
              icon={<MessageSquare className="h-4 w-4" />}
              expanded={expandedSections.has("notes")}
              onToggle={() => toggleSection("notes")}
            >
              <CandidateNotesSection
                candidateId={candidate.id}
                canEdit={canEdit}
                canDelete={isAdmin || isManager}
                currentUserId={userId}
              />
            </CollapsibleSection>

            {/* Activity Log */}
            <CollapsibleSection
              id="activity"
              title="Activity Log"
              icon={<Activity className="h-4 w-4" />}
              expanded={expandedSections.has("activity")}
              onToggle={() => toggleSection("activity")}
            >
              <div className="text-sm text-muted-foreground">
                <p>No activity recorded yet.</p>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </div>

      {/* CV Upload Modal */}
      <CVUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        candidateId={candidate.id}
        candidateName={candidate.name}
        onSuccess={() => refetch()}
      />

      {/* CV Drawer Viewer */}
      <CVDrawerViewer
        open={showCVViewer}
        onClose={() => setShowCVViewer(false)}
        storagePath={candidate.cvStoragePath}
        candidateId={candidate.id}
        candidateName={candidate.name}
        rawCvText={candidate.rawCvText}
      />
    </div>
  );
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  title,
  icon,
  badge,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                {badge && (
                  <Badge variant="secondary" className="ml-2">
                    {badge}
                  </Badge>
                )}
              </div>
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
