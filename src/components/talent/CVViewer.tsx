import { useState, useMemo, useCallback, memo } from "react";
import { Talent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  X,
  Search,
  FileText,
  Download,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Filter,
  Briefcase,
  GraduationCap,
  Tags,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  ExternalLink,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CVViewerProps {
  talent: Talent | null;
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}

// Mock CV content for demo - in real app this would come from the talent record
const getMockCVContent = (talent: Talent): string => {
  const skills = talent.skills.join(", ");
  const experience = talent.experience?.map(exp => 
    `${exp.title} at ${exp.company}\n${exp.startDate} - ${exp.current ? "Present" : exp.endDate}\n${exp.description || ""}`
  ).join("\n\n") || "Experience details not available.";
  
  return `
CURRICULUM VITAE

${talent.name}
${talent.roleType}
${talent.location || "Location not specified"}

CONTACT INFORMATION
Email: ${talent.email}
Phone: ${talent.phone || "Not provided"}
LinkedIn: ${talent.linkedIn || "Not provided"}

PROFESSIONAL SUMMARY
${talent.aiOverview || `Experienced ${talent.roleType} with expertise in ${skills}. Currently ${talent.availability} for new opportunities.`}

SKILLS
${skills}

WORK EXPERIENCE
${experience}

EDUCATION
Bachelor's Degree in Computer Science
University of Technology
2014 - 2018

CERTIFICATIONS
- AWS Certified Solutions Architect
- Google Cloud Professional Data Engineer
- Agile Scrum Master Certification

LANGUAGES
- English (Native)
- Spanish (Professional)

REFERENCES
Available upon request
`.trim();
};

// Memoized highlight component for performance
const HighlightedText = memo(({ 
  text, 
  searchTerm, 
  matchCase 
}: { 
  text: string; 
  searchTerm: string; 
  matchCase: boolean;
}) => {
  if (!searchTerm.trim()) {
    return <>{text}</>;
  }

  const flags = matchCase ? "g" : "gi";
  const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedSearch})`, flags);
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = matchCase 
          ? part === searchTerm 
          : part.toLowerCase() === searchTerm.toLowerCase();
        
        return isMatch ? (
          <mark 
            key={index} 
            className="bg-yellow-400/70 text-foreground px-0.5 rounded-sm"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
});

HighlightedText.displayName = "HighlightedText";

// Filter section component
const FilterSection = memo(({ 
  title, 
  icon: Icon, 
  checked, 
  onToggle 
}: { 
  title: string; 
  icon: React.ElementType; 
  checked: boolean; 
  onToggle: () => void;
}) => (
  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
    <Checkbox checked={checked} onCheckedChange={onToggle} />
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm">{title}</span>
  </label>
));

FilterSection.displayName = "FilterSection";

export const CVViewer = ({
  talent,
  open,
  onClose,
  onBack,
}: CVViewerProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  // Section filters
  const [filters, setFilters] = useState({
    summary: true,
    skills: true,
    experience: true,
    education: true,
    certifications: true,
    contact: true,
  });

  const cvContent = useMemo(() => {
    if (!talent) return "";
    return getMockCVContent(talent);
  }, [talent]);

  // Calculate matches for navigation
  const matches = useMemo(() => {
    if (!searchTerm.trim() || !cvContent) return [];
    
    const flags = matchCase ? "g" : "gi";
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedSearch, flags);
    const matchList: number[] = [];
    let match;
    
    while ((match = regex.exec(cvContent)) !== null) {
      matchList.push(match.index);
    }
    
    return matchList;
  }, [cvContent, searchTerm, matchCase]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentMatchIndex(0);
  }, []);

  const navigateMatch = useCallback((direction: "next" | "prev") => {
    if (matches.length === 0) return;
    
    if (direction === "next") {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    } else {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  const toggleFilter = useCallback((key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExportCV = useCallback(() => {
    // Create blob and download
    const blob = new Blob([cvContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${talent?.name?.replace(/\s+/g, "_")}_CV.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [cvContent, talent?.name]);

  if (!talent) return null;

  // Split CV into sections for filtered display
  const sections = cvContent.split("\n\n");

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        className="w-full sm:max-w-4xl p-0 flex flex-col"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold flex items-center gap-2">
                    CV Viewer
                    <Badge variant="secondary" className="font-normal">
                      {talent.name}
                    </Badge>
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">{talent.roleType}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </SheetHeader>

        {/* Split View Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: CV Content */}
          <div className="flex-1 flex flex-col border-r border-border min-w-0">
            <ScrollArea className="flex-1">
              <div className="p-6">
                {/* CV Document Container */}
                <div className="bg-card border rounded-lg shadow-sm">
                  {/* Document Header */}
                  <div className="p-6 border-b bg-muted/30">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h1 className="text-xl font-bold">
                          <HighlightedText 
                            text={talent.name} 
                            searchTerm={searchTerm} 
                            matchCase={matchCase} 
                          />
                        </h1>
                        <p className="text-muted-foreground">
                          <HighlightedText 
                            text={talent.roleType} 
                            searchTerm={searchTerm} 
                            matchCase={matchCase} 
                          />
                        </p>
                        {talent.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            <HighlightedText 
                              text={talent.location} 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Document Body */}
                  <div className="p-6 space-y-6">
                    {/* Contact Info */}
                    {filters.contact && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Contact Information
                        </h2>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Email: </span>
                            <HighlightedText 
                              text={talent.email} 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </p>
                          {talent.phone && (
                            <p>
                              <span className="text-muted-foreground">Phone: </span>
                              <HighlightedText 
                                text={talent.phone} 
                                searchTerm={searchTerm} 
                                matchCase={matchCase} 
                              />
                            </p>
                          )}
                          {talent.linkedIn && (
                            <p className="flex items-center gap-1">
                              <span className="text-muted-foreground">LinkedIn: </span>
                              <a 
                                href={talent.linkedIn} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <HighlightedText 
                                  text={talent.linkedIn} 
                                  searchTerm={searchTerm} 
                                  matchCase={matchCase} 
                                />
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </p>
                          )}
                        </div>
                      </section>
                    )}

                    {filters.contact && <Separator />}

                    {/* Professional Summary */}
                    {filters.summary && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Professional Summary
                        </h2>
                        <p className="text-sm leading-relaxed">
                          <HighlightedText 
                            text={talent.aiOverview || `Experienced ${talent.roleType} with expertise in ${talent.skills.join(", ")}. Currently ${talent.availability} for new opportunities.`} 
                            searchTerm={searchTerm} 
                            matchCase={matchCase} 
                          />
                        </p>
                      </section>
                    )}

                    {filters.summary && <Separator />}

                    {/* Skills */}
                    {filters.skills && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Tags className="h-4 w-4" />
                          Skills
                        </h2>
                        <div className="flex flex-wrap gap-2">
                          {talent.skills.map((skill) => (
                            <Badge 
                              key={skill} 
                              variant="secondary"
                              className={cn(
                                searchTerm && 
                                (matchCase 
                                  ? skill.includes(searchTerm)
                                  : skill.toLowerCase().includes(searchTerm.toLowerCase())
                                ) && "bg-yellow-400/30 border-yellow-400"
                              )}
                            >
                              <HighlightedText 
                                text={skill} 
                                searchTerm={searchTerm} 
                                matchCase={matchCase} 
                              />
                            </Badge>
                          ))}
                        </div>
                      </section>
                    )}

                    {filters.skills && <Separator />}

                    {/* Experience */}
                    {filters.experience && talent.experience && talent.experience.length > 0 && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Work Experience
                        </h2>
                        <div className="space-y-4">
                          {talent.experience.map((exp) => (
                            <div key={exp.id} className="border-l-2 border-primary/30 pl-4">
                              <h3 className="font-medium">
                                <HighlightedText 
                                  text={exp.title} 
                                  searchTerm={searchTerm} 
                                  matchCase={matchCase} 
                                />
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                <HighlightedText 
                                  text={exp.company} 
                                  searchTerm={searchTerm} 
                                  matchCase={matchCase} 
                                />
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {exp.startDate} - {exp.current ? "Present" : exp.endDate}
                              </p>
                              {exp.description && (
                                <p className="text-sm mt-2">
                                  <HighlightedText 
                                    text={exp.description} 
                                    searchTerm={searchTerm} 
                                    matchCase={matchCase} 
                                  />
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {filters.experience && <Separator />}

                    {/* Education */}
                    {filters.education && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Education
                        </h2>
                        <div className="border-l-2 border-primary/30 pl-4">
                          <h3 className="font-medium">
                            <HighlightedText 
                              text="Bachelor's Degree in Computer Science" 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            <HighlightedText 
                              text="University of Technology" 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">2014 - 2018</p>
                        </div>
                      </section>
                    )}

                    {filters.certifications && <Separator />}

                    {/* Certifications */}
                    {filters.certifications && (
                      <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Certifications
                        </h2>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <HighlightedText 
                              text="AWS Certified Solutions Architect" 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <HighlightedText 
                              text="Google Cloud Professional Data Engineer" 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <HighlightedText 
                              text="Agile Scrum Master Certification" 
                              searchTerm={searchTerm} 
                              matchCase={matchCase} 
                            />
                          </li>
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right: Search & Filters */}
          <div className="w-72 flex flex-col bg-muted/30">
            {/* Search Box */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search in CV..."
                  className="pl-9 pr-4"
                />
              </div>
              
              {/* Match navigation */}
              {matches.length > 0 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">
                    {currentMatchIndex + 1} of {matches.length} matches
                  </span>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => navigateMatch("prev")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => navigateMatch("next")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Match case toggle */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <Checkbox 
                  checked={matchCase} 
                  onCheckedChange={(checked) => setMatchCase(!!checked)} 
                />
                <span className="text-xs text-muted-foreground">Match case</span>
              </label>
            </div>

            {/* Section Filters */}
            <div className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Show Sections</span>
              </div>
              <div className="space-y-1">
                <FilterSection 
                  title="Contact Info" 
                  icon={Mail} 
                  checked={filters.contact}
                  onToggle={() => toggleFilter("contact")}
                />
                <FilterSection 
                  title="Summary" 
                  icon={Sparkles} 
                  checked={filters.summary}
                  onToggle={() => toggleFilter("summary")}
                />
                <FilterSection 
                  title="Skills" 
                  icon={Tags} 
                  checked={filters.skills}
                  onToggle={() => toggleFilter("skills")}
                />
                <FilterSection 
                  title="Experience" 
                  icon={Briefcase} 
                  checked={filters.experience}
                  onToggle={() => toggleFilter("experience")}
                />
                <FilterSection 
                  title="Education" 
                  icon={GraduationCap} 
                  checked={filters.education}
                  onToggle={() => toggleFilter("education")}
                />
                <FilterSection 
                  title="Certifications" 
                  icon={FileText} 
                  checked={filters.certifications}
                  onToggle={() => toggleFilter("certifications")}
                />
              </div>
            </div>

            {/* Quick Info Footer */}
            <div className="p-4 border-t border-border bg-background/50">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Skills</span>
                  <Badge variant="secondary" className="text-xs">
                    {talent.skills.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Experience</span>
                  <Badge variant="secondary" className="text-xs">
                    {talent.experience?.length || 0} roles
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {talent.availability}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
