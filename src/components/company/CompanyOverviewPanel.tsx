import { useState } from "react";
import { Account, Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2,
  Users,
  Network,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  X,
  GitBranch,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanySnapshotCard } from "./CompanySnapshotCard";
import { CompanyRelationshipIntel } from "./CompanyRelationshipIntel";
import { CompanyContactsList } from "./CompanyContactsList";
import { CompanyEngagementContext } from "./CompanyEngagementContext";
import { CompanyLocationsSection } from "./CompanyLocationsSection";
import { OrgChartBuilderModal } from "@/components/orgchart/OrgChartBuilderModal";
import { WebResearchWizard } from "@/components/orgchart/WebResearchWizard";
import { useToast } from "@/hooks/use-toast";

interface CompanyOverviewPanelProps {
  company: Account | null;
  open: boolean;
  onClose: () => void;
  onOpenCanvas: (company: Account) => void;
  onViewContacts: (company: Account) => void;
  onContactClick?: (contact: Contact) => void;
}

export function CompanyOverviewPanel({
  company,
  open,
  onClose,
  onOpenCanvas,
  onViewContacts,
  onContactClick,
}: CompanyOverviewPanelProps) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    locations: false,
    intelligence: true,
    contacts: false,
    engagement: false,
    documents: false,
  });
  const [showOrgChartBuilder, setShowOrgChartBuilder] = useState(false);
  const [showWebResearch, setShowWebResearch] = useState(false);

  if (!company) return null;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Handle import from web research
  const handleWebResearchImport = () => {
    // The WebResearchWizard handles the flow and closes itself
    // We just need to show a success message
    toast({
      title: "Contacts Added",
      description: "Web research contacts have been added to review",
    });
    setShowWebResearch(false);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col"
      >
        {/* Sticky Header */}
        <SheetHeader className="px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">
                  Company Record
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Single source of truth
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* A. Company Snapshot Card (Top) */}
            <section>
              <CompanySnapshotCard company={company} />
            </section>

            <Separator />

            {/* B. Locations & Offices */}
            <Collapsible
              open={expandedSections.locations}
              onOpenChange={() => toggleSection("locations")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Locations & Offices
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {company.locations?.length || 0}
                  </Badge>
                  {expandedSections.locations ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CompanyLocationsSection locations={company.locations || []} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* C. Relationship Intelligence */}
            <Collapsible
              open={expandedSections.intelligence}
              onOpenChange={() => toggleSection("intelligence")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  Relationship Intelligence
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    Core
                  </Badge>
                  {expandedSections.intelligence ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CompanyRelationshipIntel company={company} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* D. Associated Contacts */}
            <Collapsible
              open={expandedSections.contacts}
              onOpenChange={() => toggleSection("contacts")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Associated Contacts
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {company.contacts.length}
                  </Badge>
                  {expandedSections.contacts ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CompanyContactsList 
                  contacts={company.contacts} 
                  onContactClick={onContactClick}
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* E. Commercial & Engagement Context */}
            <Collapsible
              open={expandedSections.engagement}
              onOpenChange={() => toggleSection("engagement")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Commercial Context
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                  {expandedSections.engagement ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CompanyEngagementContext company={company} />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* F. Documents & Knowledge */}
            <Collapsible
              open={expandedSections.documents}
              onOpenChange={() => toggleSection("documents")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Documents & Knowledge
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                  {expandedSections.documents ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="p-6 rounded-lg border border-dashed border-border text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No documents linked yet
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Link Document
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* Sticky Actions Footer - Minimal, Clear Actions */}
        <div className="border-t border-border bg-card px-6 py-4">
          <div className="flex flex-col gap-3">
            {/* Primary Actions */}
            <div className="flex items-center gap-3">
              <Button
                className="flex-1"
                onClick={() => onOpenCanvas(company)}
              >
                <Network className="h-4 w-4 mr-2" />
                Open on Canvas
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowOrgChartBuilder(true)}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Build Org Chart
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onViewContacts(company)}
              >
                <Users className="h-4 w-4 mr-2" />
                View Contacts
              </Button>
            </div>
            {/* Secondary Actions - AI Research */}
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                className="flex-1 gap-2"
                onClick={() => setShowWebResearch(true)}
              >
                <Globe className="h-4 w-4" />
                AI Research Assistant
                <Badge variant="outline" className="ml-1 text-xs">Beta</Badge>
              </Button>
              <Button variant="outline" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Org Chart Builder Modal */}
        <OrgChartBuilderModal
          open={showOrgChartBuilder}
          onOpenChange={setShowOrgChartBuilder}
          companyId={company.id}
          companyName={company.name}
        />

        {/* Web Research Wizard */}
        <WebResearchWizard
          open={showWebResearch}
          onOpenChange={setShowWebResearch}
          companyId={company.id}
          companyName={company.name}
          onImportContacts={handleWebResearchImport}
        />
      </SheetContent>
    </Sheet>
  );
}
