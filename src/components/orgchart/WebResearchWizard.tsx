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
  ArrowDown,
  User,
  Info,
} from "lucide-react";
import { WebResearchConfigModal } from "./WebResearchConfigModal";
import { WebResearchResults, WebResearchLoading } from "./WebResearchResults";
import { useWebResearch } from "@/hooks/use-web-research";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgChartTree } from "@/hooks/use-org-chart-tree";
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

  // Fetch existing contacts for this company
  const { data: existingContacts = [] } = useQuery({
    queryKey: ["company-contacts-for-research", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, title, department")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name");
      return data || [];
    },
    enabled: !!companyId && open,
  });

  // Fetch org chart tree for hierarchy
  const { nodes: orgNodes } = useOrgChartTree(companyId);

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

  // Start research — pass existing contacts so AI skips them
  const handleStartResearch = useCallback(async (searchConfig: WebResearchConfig) => {
    // Enrich config with existing contacts
    const enrichedConfig = {
      ...searchConfig,
      existingContacts: existingContacts.map((c) => ({
        name: c.name,
        title: c.title || "",
      })),
    };
    setConfig(enrichedConfig);
    setStep("searching");
    
    try {
      const searchResult = await executeSearch(enrichedConfig);
      
      if (searchResult.success && searchResult.people.length > 0) {
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
  }, [executeSearch, toast, existingContacts]);

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
      sourceType: "public_web",
      sourceUrls: person.sources.map((s) => s.url),
      verified: false,
      placeholder: true,
    } as OrgChartRow));

    onImportContacts(rows);
    handleOpenChange(false);
    
    toast({
      title: "Contacts Added",
      description: `${rows.length} contacts added for review. You can edit their positions on the Org Chart.`,
    });
  }, [result, selectedIds, companyName, onImportContacts, toast]);

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
              existingContacts={existingContacts}
              orgNodes={orgNodes}
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
          AI will analyse public knowledge to suggest potential leadership 
          contacts and their reporting structure for your org chart.
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

// ─── Hierarchy node type for the preview tree ────────────────────────────────
interface TreeNode {
  id: string;
  name: string;
  title: string;
  department?: string;
  isExisting: boolean; // true = already on chart (blue), false = AI suggestion (amber)
  confidence?: "high" | "medium" | "low";
  children: TreeNode[];
}

// Preview Step - Overlay hierarchy showing existing (blue) + suggested (amber)
function PreviewStep({
  people,
  companyName,
  existingContacts,
  orgNodes,
}: {
  people: WebResearchPerson[];
  companyName: string;
  existingContacts: Array<{ id: string; name: string; title: string | null; department: string | null }>;
  orgNodes: Array<{ contactId: string; parentContactId: string | null }>;
}) {
  // Build a unified tree: existing contacts + AI suggestions merged by reportsTo
  const buildTree = (): TreeNode[] => {
    // Create a lookup of existing contacts by name (lowercased)
    const existingByName = new Map<string, typeof existingContacts[0]>();
    existingContacts.forEach((c) => existingByName.set(c.name.toLowerCase(), c));

    // Create a lookup of existing contacts by id
    const existingById = new Map<string, typeof existingContacts[0]>();
    existingContacts.forEach((c) => existingById.set(c.id, c));

    // Build parent map from org_chart_edges
    const parentMap = new Map<string, string | null>();
    orgNodes.forEach((n) => parentMap.set(n.contactId, n.parentContactId));

    // Build existing tree nodes
    const existingNodes = new Map<string, TreeNode>();
    existingContacts.forEach((c) => {
      existingNodes.set(c.id, {
        id: c.id,
        name: c.name,
        title: c.title || "",
        department: c.department || undefined,
        isExisting: true,
        children: [],
      });
    });

    // Link existing nodes by parent
    const existingRoots: TreeNode[] = [];
    existingContacts.forEach((c) => {
      const node = existingNodes.get(c.id)!;
      const parentId = parentMap.get(c.id);
      if (parentId && existingNodes.has(parentId)) {
        existingNodes.get(parentId)!.children.push(node);
      } else {
        existingRoots.push(node);
      }
    });

    // Now place AI suggestions
    const suggestedNodes: TreeNode[] = [];
    people.forEach((p) => {
      const sugNode: TreeNode = {
        id: p.id,
        name: p.name,
        title: p.title,
        department: p.department,
        isExisting: false,
        confidence: p.confidence,
        children: [],
      };

      // Try to attach to an existing contact by reportsTo name match
      if (p.reportsTo) {
        const managerName = p.reportsTo.toLowerCase();
        // Check existing contacts first
        let attached = false;
        for (const [, node] of existingNodes) {
          if (node.name.toLowerCase() === managerName) {
            node.children.push(sugNode);
            attached = true;
            break;
          }
        }
        // Check other suggested people
        if (!attached) {
          const parentSuggestion = suggestedNodes.find(
            (s) => s.name.toLowerCase() === managerName
          );
          if (parentSuggestion) {
            parentSuggestion.children.push(sugNode);
            attached = true;
          }
        }
        if (!attached) {
          suggestedNodes.push(sugNode);
        }
      } else {
        suggestedNodes.push(sugNode);
      }
    });

    // Merge: existing roots + unattached suggestions
    return [...existingRoots, ...suggestedNodes];
  };

  const tree = buildTree();

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Hierarchy Preview</h3>
        <p className="text-muted-foreground text-sm">
          See where AI-suggested contacts sit relative to your existing org chart
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary/20 border-2 border-primary" />
          <span className="text-muted-foreground">Existing contacts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-500 border-dashed" />
          <span className="text-muted-foreground">AI suggestions (new)</span>
        </div>
      </div>

      {/* Tree view */}
      <div className="border rounded-lg bg-muted/30 p-4 overflow-x-auto max-h-[360px] overflow-y-auto">
        {tree.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No hierarchy to preview</p>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <HierarchyNode key={node.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* User guidance */}
      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-muted-foreground">
          <strong className="text-foreground">After accepting:</strong> Contacts will be added as unverified placeholders 
          with dashed borders. Use the Org Chart editor to drag, reposition, and verify each person 
          before saving to your CRM.
        </div>
      </div>
    </div>
  );
}

// Recursive hierarchy node renderer
function HierarchyNode({ node, depth }: { node: TreeNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5"
        style={{ paddingLeft: `${depth * 24 + 4}px` }}
      >
        {depth > 0 && (
          <ArrowDown className="h-3 w-3 text-muted-foreground/50 -rotate-90 flex-shrink-0" />
        )}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md border-2 text-sm flex-1 min-w-0",
            node.isExisting
              ? "bg-primary/10 border-primary/40 text-foreground"
              : "bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 border-dashed text-foreground"
          )}
        >
          <User className={cn(
            "h-3.5 w-3.5 flex-shrink-0",
            node.isExisting ? "text-primary" : "text-amber-600 dark:text-amber-400"
          )} />
          <span className="font-medium truncate">{node.name}</span>
          <span className="text-muted-foreground truncate text-xs">— {node.title}</span>
          {!node.isExisting && node.confidence && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] ml-auto flex-shrink-0",
                node.confidence === "high" && "border-green-500 text-green-700 dark:text-green-400",
                node.confidence === "medium" && "border-amber-500 text-amber-700 dark:text-amber-400",
                node.confidence === "low" && "border-red-500 text-red-700 dark:text-red-400"
              )}
            >
              {node.confidence}
            </Badge>
          )}
          {node.isExisting && (
            <Badge variant="secondary" className="text-[10px] ml-auto flex-shrink-0">
              existing
            </Badge>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
