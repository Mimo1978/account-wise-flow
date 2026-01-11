import { useState } from "react";
import { Talent, TalentAvailability, TalentStatus, TalentExperience } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  X,
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
  Save,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TalentProfilePanelProps {
  talent: Talent | null;
  open: boolean;
  onClose: () => void;
  onSkillFilter?: (skill: string) => void;
  onViewCV?: () => void;
}

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

// Mock experience data for demo
const getMockExperience = (talentId: string): TalentExperience[] => {
  const experiences: Record<string, TalentExperience[]> = {
    t1: [
      { id: "e1", company: "DataFlow Inc", title: "Senior Data Engineer", startDate: "2022-03", current: true, description: "Led data pipeline development for financial services clients." },
      { id: "e2", company: "TechCorp", title: "Data Engineer", startDate: "2019-06", endDate: "2022-02", description: "Built ETL processes and data warehousing solutions." },
      { id: "e3", company: "StartupXYZ", title: "Junior Developer", startDate: "2017-01", endDate: "2019-05", description: "Full stack development with Python and React." },
    ],
    t2: [
      { id: "e1", company: "ConsultPro", title: "Business Analyst", startDate: "2021-01", current: true, description: "Requirements gathering and stakeholder management." },
      { id: "e2", company: "FinanceHub", title: "Junior Analyst", startDate: "2018-09", endDate: "2020-12", description: "Financial analysis and reporting." },
    ],
    t3: [
      { id: "e1", company: "CloudMasters", title: "Principal Architect", startDate: "2020-06", current: true, description: "Enterprise cloud architecture and strategy." },
      { id: "e2", company: "BigTech Corp", title: "Senior Solutions Architect", startDate: "2016-03", endDate: "2020-05", description: "AWS and Azure implementations." },
      { id: "e3", company: "Innovation Labs", title: "Solutions Architect", startDate: "2012-08", endDate: "2016-02", description: "Microservices architecture design." },
    ],
  };
  return experiences[talentId] || [
    { id: "e1", company: "Previous Company", title: "Senior Role", startDate: "2021-01", current: true, description: "Current position." },
    { id: "e2", company: "Earlier Company", title: "Mid-Level Role", startDate: "2018-06", endDate: "2020-12", description: "Previous experience." },
  ];
};

// Mock AI overview for demo
const getMockAIOverview = (talent: Talent): string => {
  return talent.aiOverview || `${talent.name} is a ${seniorityLabels[talent.seniority].toLowerCase()}-level ${talent.roleType} with expertise in ${talent.skills.slice(0, 3).join(", ")}. ${talent.notes || ""} Currently ${availabilityLabels[talent.availability].toLowerCase()} for new opportunities.`;
};

export const TalentProfilePanel = ({
  talent,
  open,
  onClose,
  onSkillFilter,
  onViewCV,
}: TalentProfilePanelProps) => {
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [editedOverview, setEditedOverview] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>(["overview", "skills"]);

  if (!talent) return null;

  const experience = talent.experience || getMockExperience(talent.id);
  const aiOverview = getMockAIOverview(talent);

  const handleEditOverview = () => {
    setEditedOverview(aiOverview);
    setIsEditingOverview(true);
  };

  const handleSaveOverview = () => {
    // In real app, this would update the talent record
    console.log("Saving overview:", editedOverview);
    setIsEditingOverview(false);
    toast.success("AI Overview updated");
  };

  const handleSkillClick = (skill: string) => {
    if (onSkillFilter) {
      onSkillFilter(skill);
      onClose();
      toast.success(`Filtering by skill: ${skill}`);
    }
  };

  const handleViewCV = () => {
    if (onViewCV) {
      onViewCV();
    } else if (talent.cvUrl) {
      window.open(talent.cvUrl, "_blank");
    } else {
      toast.info("CV not available for this candidate");
    }
  };

  const handleExportCV = () => {
    toast.success("CV exported successfully");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const getDataQualityBadge = () => {
    if (talent.dataQuality === "parsed") {
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
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl font-semibold">{talent.name}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{talent.roleType}</p>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("font-medium", availabilityColors[talent.availability])}>
              {availabilityLabels[talent.availability]}
            </Badge>
            <Badge className={statusColors[talent.status]}>
              {statusLabels[talent.status]}
            </Badge>
            {getDataQualityBadge()}
            {talent.rate && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                {talent.rate}
              </Badge>
            )}
          </div>

          {/* Contact Details */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${talent.email}`} className="text-primary hover:underline">
                {talent.email}
              </a>
            </div>
            {talent.phoneNumbers?.map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{phone.value}</span>
                <Badge variant="outline" className="text-xs">{phone.label}</Badge>
                {phone.preferred && (
                  <Badge variant="secondary" className="text-xs">Preferred</Badge>
                )}
              </div>
            ))}
            {talent.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{talent.location}</span>
              </div>
            )}
            {talent.linkedIn && (
              <div className="flex items-center gap-2 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a
                  href={talent.linkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  LinkedIn Profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 pt-4">
            <Accordion
              type="multiple"
              value={expandedSections}
              onValueChange={setExpandedSections}
              className="space-y-3"
            >
              {/* AI Candidate Overview */}
              <AccordionItem value="overview" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">AI Candidate Overview</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    {isEditingOverview ? (
                      <>
                        <Textarea
                          value={editedOverview}
                          onChange={(e) => setEditedOverview(e.target.value)}
                          className="min-h-[120px] resize-none"
                          placeholder="Enter AI-generated candidate overview..."
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveOverview}>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingOverview(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {aiOverview}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEditOverview}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Overview
                        </Button>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Skills */}
              <AccordionItem value="skills" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Tags className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">Skills</span>
                    <Badge variant="secondary" className="ml-2">
                      {talent.skills.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="flex flex-wrap gap-2">
                    {talent.skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground",
                          onSkillFilter && "hover:border-primary"
                        )}
                        onClick={() => handleSkillClick(skill)}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  {onSkillFilter && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Click a skill to filter the talent table
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Experience */}
              <AccordionItem value="experience" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">Experience</span>
                    <Badge variant="secondary" className="ml-2">
                      {experience.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
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
                </AccordionContent>
              </AccordionItem>

              {/* CV */}
              <AccordionItem value="cv" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">CV / Resume</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleViewCV}>
                      <FileText className="h-4 w-4 mr-2" />
                      View CV
                    </Button>
                    <Button variant="outline" onClick={handleExportCV}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CV
                    </Button>
                  </div>
                  {!talent.cvUrl && (
                    <p className="text-xs text-muted-foreground mt-3">
                      No CV has been uploaded for this candidate yet.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Seniority & Rate Footer */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">{seniorityLabels[talent.seniority]}</span>
                  {talent.rate && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="text-green-500 font-medium">{talent.rate}</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  Last updated: {talent.lastUpdated || "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
