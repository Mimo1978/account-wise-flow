import { useState } from "react";
import { Account, Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  TrendingUp,
  AlertCircle,
  Shield,
  Sparkles,
  ExternalLink,
  Calendar,
  FileText,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyRelationshipIntel } from "./CompanyRelationshipIntel";
import { CompanyContactsList } from "./CompanyContactsList";
import { CompanyEngagementContext } from "./CompanyEngagementContext";

interface CompanyOverviewPanelProps {
  company: Account | null;
  open: boolean;
  onClose: () => void;
  onOpenCanvas: (company: Account) => void;
  onViewContacts: (company: Account) => void;
  onContactClick?: (contact: Contact) => void;
}

const getRelationshipStatus = (score: number) => {
  if (score >= 80) return { label: "Active", color: "bg-green-500/10 text-green-600 border-green-200" };
  if (score >= 60) return { label: "Warm", color: "bg-blue-500/10 text-blue-600 border-blue-200" };
  if (score >= 40) return { label: "Cooling", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" };
  return { label: "Dormant", color: "bg-muted text-muted-foreground border-border" };
};

export function CompanyOverviewPanel({
  company,
  open,
  onClose,
  onOpenCanvas,
  onViewContacts,
  onContactClick,
}: CompanyOverviewPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    intelligence: true,
    contacts: true,
    engagement: false,
    documents: false,
  });

  if (!company) return null;

  const relationshipStatus = getRelationshipStatus(company.engagementScore);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Generate AI summary based on available data
  const generateAISummary = () => {
    const championCount = company.contacts.filter(c => c.status === "champion").length;
    const blockerCount = company.knownBlockers?.length || 0;
    const executiveCount = company.contacts.filter(c => c.seniority === "executive").length;
    
    const parts = [];
    if (championCount > 0) {
      parts.push(`${championCount} active champion${championCount > 1 ? 's' : ''}`);
    }
    if (executiveCount > 0) {
      parts.push(`${executiveCount} executive relationship${executiveCount > 1 ? 's' : ''}`);
    }
    if (blockerCount > 0) {
      parts.push(`${blockerCount} potential blocker${blockerCount > 1 ? 's' : ''} identified`);
    }
    
    if (parts.length === 0) {
      return "Early-stage relationship. Consider expanding contacts across key departments.";
    }
    
    return parts.join(". ") + ".";
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col"
      >
        {/* Sticky Header */}
        <SheetHeader className="px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-xl font-bold truncate">
                  {company.name}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="secondary" className="font-normal">
                    {company.industry}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn("font-medium", relationshipStatus.color)}
                  >
                    {relationshipStatus.label}
                  </Badge>
                  {company.size && (
                    <span className="text-xs text-muted-foreground">
                      {company.size}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* Company Snapshot */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4" />
                Company Snapshot
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Engagement
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{company.engagementScore}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3 w-3" />
                    Contacts
                  </div>
                  <span className="text-2xl font-bold">{company.contacts.length}</span>
                </div>
                
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="h-3 w-3" />
                    Last Activity
                  </div>
                  <span className="text-sm font-medium truncate block">
                    {company.lastInteraction || company.lastUpdated || "—"}
                  </span>
                </div>
                
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Shield className="h-3 w-3" />
                    Account Lead
                  </div>
                  <span className="text-sm font-medium truncate block">
                    {company.accountManager?.name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* AI Summary */}
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">AI Relationship Summary</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {generateAISummary()}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Relationship Intelligence */}
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
                  <Badge variant="outline" className="text-xs">
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

            {/* Associated Contacts */}
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

            {/* Commercial & Engagement Context */}
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

            {/* Documents & Knowledge */}
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

        {/* Sticky Actions Footer */}
        <div className="border-t border-border bg-card px-6 py-4 space-y-3">
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
              onClick={() => onViewContacts(company)}
            >
              <Users className="h-4 w-4 mr-2" />
              View Contacts
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask AI
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <ExternalLink className="h-4 w-4 mr-2" />
              Add Engagement
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
