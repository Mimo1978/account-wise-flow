import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Globe,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Eye,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import { WebResearchConfigModal } from "./WebResearchConfigModal";
import { WebResearchResults, WebResearchLoading } from "./WebResearchResults";
import { useWebResearch } from "@/hooks/use-web-research";
import { useToast } from "@/hooks/use-toast";
import type {
  WebResearchConfig,
  WebResearchResult,
  WebResearchPerson,
} from "@/lib/web-research-types";
import type { OrgChartRow } from "./OrgChartBuilderModal";

interface WebResearchWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onImportContacts: (rows: OrgChartRow[]) => void;
}

type WizardStep = "config" | "searching" | "results" | "preview";

const STEPS = [
  { id: "config", label: "Configure", icon: Globe },
  { id: "searching", label: "Search", icon: Search },
  { id: "results", label: "Review", icon: ListChecks },
  { id: "preview", label: "Preview", icon: Eye },
] as const;

export function WebResearchWizard({
  open,
  onOpenChange,
  companyId,
  companyName,
  onImportContacts,
}: WebResearchWizardProps) {
  const { toast } = useToast();
  const { executeSearch, isSearching, result, reset } = useWebResearch();
  
  const [step, setStep] = useState<WizardStep>("config");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<WebResearchConfig | null>(null);

  // Reset when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("config");
      setSelectedIds(new Set());
      setConfig(null);
      reset();
    }
    onOpenChange(isOpen);
  };

  // Start research
  const handleStartResearch = useCallback(async (searchConfig: WebResearchConfig) => {
    setConfig(searchConfig);
    setStep("searching");
    
    try {
      const searchResult = await executeSearch(searchConfig);
      
      if (searchResult.success && searchResult.people.length > 0) {
        // Auto-select high confidence results
        const highConfIds = new Set(
          searchResult.people
            .filter((p) => p.confidence === "high")
            .map((p) => p.id)
        );
        setSelectedIds(highConfIds);
        setStep("results");
        
        toast({
          title: "Research Complete",
          description: `Found ${searchResult.stats.totalFound} potential contacts`,
        });
      } else if (searchResult.success) {
        toast({
          title: "No Results Found",
          description: "No leadership information found for this company",
          variant: "destructive",
        });
        setStep("config");
      } else {
        toast({
          title: "Research Failed",
          description: searchResult.error || "An error occurred",
          variant: "destructive",
        });
        setStep("config");
      }
    } catch (err) {
      toast({
        title: "Research Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setStep("config");
    }
  }, [executeSearch, toast]);

  // Convert selected people to OrgChartRows and import
  const handleImport = useCallback(() => {
    if (!result) return;

    const selectedPeople = result.people.filter((p) => selectedIds.has(p.id));
    
    const rows: OrgChartRow[] = selectedPeople.map((person) => ({
      id: person.id,
      full_name: person.name,
      job_title: person.title,
      department: person.department || "",
      location: person.location || "",
      company: companyName,
      confidence: person.confidence,
      isDuplicate: false,
      duplicateAction: null,
      selected: true,
      validationErrors: [],
      // Preserve source metadata
      sourceType: "public_web",
      sourceUrls: person.sources.map((s) => s.url),
      verified: false,
      placeholder: true,
    } as OrgChartRow));

    onImportContacts(rows);
    handleOpenChange(false);
    
    toast({
      title: "Contacts Added",
      description: `${rows.length} contacts added for review`,
    });
  }, [result, selectedIds, companyName, onImportContacts, toast]);

  // Current step index for stepper
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                AI Research Assistant
                <Badge variant="secondary" className="text-xs font-normal">
                  Beta
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Discover org chart from public sources — {companyName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 py-4 border-b border-border">
          {STEPS.map((s, index) => {
            const StepIcon = s.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = s.id === step;
            const isSearchStep = s.id === "searching";

            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary bg-primary/10",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isSearchStep && isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-primary",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2",
                      index < currentStepIndex ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[400px]">
          {step === "config" && (
            <ConfigStep
              companyName={companyName}
              companyId={companyId}
              onStartResearch={handleStartResearch}
            />
          )}
          
          {step === "searching" && (
            <WebResearchLoading companyName={companyName} />
          )}
          
          {step === "results" && result && (
            <WebResearchResults
              result={result}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
          
          {step === "preview" && result && (
            <PreviewStep
              people={result.people.filter((p) => selectedIds.has(p.id))}
              companyName={companyName}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          
          <div className="flex items-center gap-2">
            {step === "results" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("config")}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep("preview")}
                  disabled={selectedCount === 0}
                >
                  Preview ({selectedCount})
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
            
            {step === "preview" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("results")}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Review
                </Button>
                <Button onClick={handleImport}>
                  <Check className="h-4 w-4 mr-1" />
                  Add to Org Chart ({selectedCount})
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Config Step - Inline version
function ConfigStep({
  companyName,
  companyId,
  onStartResearch,
}: {
  companyName: string;
  companyId: string;
  onStartResearch: (config: WebResearchConfig) => void;
}) {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Globe className="h-8 w-8 text-primary" />
      </div>
      
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">Research {companyName}</h3>
        <p className="text-muted-foreground">
          AI will search public sources (company websites, press releases, news) 
          to suggest potential leadership contacts for your org chart.
        </p>
      </div>

      <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg max-w-md">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Results require your review.</strong> All suggestions are 
          placeholders until you verify and confirm them.
        </div>
      </div>

      <Button size="lg" onClick={() => setShowConfig(true)}>
        <Search className="h-4 w-4 mr-2" />
        Configure Search
      </Button>

      <WebResearchConfigModal
        open={showConfig}
        onOpenChange={setShowConfig}
        companyName={companyName}
        companyId={companyId}
        onStartResearch={(config) => {
          setShowConfig(false);
          onStartResearch(config);
        }}
      />
    </div>
  );
}

// Preview Step - Show what will be added
function PreviewStep({
  people,
  companyName,
}: {
  people: WebResearchPerson[];
  companyName: string;
}) {
  // Group by department
  const byDepartment: Record<string, WebResearchPerson[]> = {};
  people.forEach((p) => {
    const dept = p.department || "Uncategorized";
    if (!byDepartment[dept]) byDepartment[dept] = [];
    byDepartment[dept].push(p);
  });

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Preview Import</h3>
        <p className="text-muted-foreground">
          {people.length} contacts will be added to {companyName} as unverified placeholders
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(byDepartment).map(([dept, deptPeople]) => (
          <div key={dept} className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium mb-2">{dept}</h4>
            <div className="space-y-1">
              {deptPeople.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs border-dashed",
                      p.confidence === "high" && "border-green-500 text-green-700",
                      p.confidence === "medium" && "border-amber-500 text-amber-700",
                      p.confidence === "low" && "border-red-500 text-red-700"
                    )}
                  >
                    {p.confidence[0].toUpperCase()}
                  </Badge>
                  <span className="truncate">{p.name}</span>
                  <span className="text-muted-foreground truncate">— {p.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
        <strong>Note:</strong> These contacts will be added as unverified placeholders with 
        dashed borders. You can edit, verify, or remove them before saving to your CRM.
      </div>
    </div>
  );
}
