import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  UserPlus, 
  RefreshCw, 
  X, 
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  ExternalLink,
  Check,
  XCircle,
  Building2,
  Users,
  Shield,
  Info
} from "lucide-react";
import { Account, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RoleSuggestion {
  id: string;
  roleName: string;
  department: string;
  seniority: string;
  likelyInfluence: "high" | "medium" | "low";
  reason: string;
  typicalResponsibilities: string[];
  potentialConcerns: string;
  suggestedApproach: string;
  relatedExistingContacts: string[];
}

interface DepartmentGap {
  department: string;
  reason: string;
  suggestedRoles: string[];
}

interface HierarchyGap {
  gap: string;
  suggestedRoles: string[];
}

interface SuggestionsData {
  suggestions: RoleSuggestion[];
  departmentGaps: DepartmentGap[];
  hierarchyGaps: HierarchyGap[];
}

interface AIRoleSuggestionsPanelProps {
  account: Account;
  isOpen: boolean;
  onToggle: () => void;
  onAddContact: (contact: Partial<Contact>) => void;
}

const SUGGESTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-role-suggestions`;

export function AIRoleSuggestionsPanel({
  account,
  isOpen,
  onToggle,
  onAddContact,
}: AIRoleSuggestionsPanelProps) {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<RoleSuggestion | null>(null);
  const [showExternalLookupDialog, setShowExternalLookupDialog] = useState(false);
  const [pendingLookupRole, setPendingLookupRole] = useState<RoleSuggestion | null>(null);

  const buildAccountContext = useCallback(() => {
    return {
      accountName: account.name,
      industry: account.industry,
      companySize: account.size,
      contacts: account.contacts.map(c => ({
        id: c.id,
        name: c.name,
        title: c.title,
        department: c.department,
        seniority: c.seniority,
        status: c.status,
        role: c.role,
      })),
    };
  }, [account]);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(SUGGESTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          accountContext: buildAccountContext(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
    } catch (err) {
      console.error("AI suggestions error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [buildAccountContext]);

  useEffect(() => {
    if (isOpen && !data && !isLoading) {
      fetchSuggestions();
    }
  }, [isOpen, data, isLoading, fetchSuggestions]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    toast.info("Suggestion dismissed");
  };

  const handleAddAsPlaceholder = (suggestion: RoleSuggestion) => {
    const newContact: Partial<Contact> = {
      id: `placeholder-${Date.now()}`,
      name: `[${suggestion.roleName}]`,
      title: suggestion.roleName,
      department: suggestion.department,
      seniority: suggestion.seniority as Contact["seniority"],
      email: "",
      phone: "",
      status: "unknown",
      notes: [{
        id: `note-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        author: "AI Assistant",
        content: `Suggested role: ${suggestion.reason}\n\nPotential concerns: ${suggestion.potentialConcerns}\n\nSuggested approach: ${suggestion.suggestedApproach}`,
        pinned: true,
      }],
    };
    
    onAddContact(newContact as Contact);
    handleDismiss(suggestion.id);
    toast.success(`Added placeholder for ${suggestion.roleName}`);
  };

  const handleRequestExternalLookup = (suggestion: RoleSuggestion) => {
    setPendingLookupRole(suggestion);
    setShowExternalLookupDialog(true);
  };

  const handleConfirmExternalLookup = () => {
    if (pendingLookupRole) {
      // In a real implementation, this would trigger a LinkedIn or other external lookup
      toast.info("External lookup feature coming soon", {
        description: "This would search LinkedIn for people with this role at the company."
      });
    }
    setShowExternalLookupDialog(false);
    setPendingLookupRole(null);
  };

  const visibleSuggestions = data?.suggestions.filter(s => !dismissedIds.has(s.id)) || [];
  const highPriority = visibleSuggestions.filter(s => s.likelyInfluence === "high");
  const mediumPriority = visibleSuggestions.filter(s => s.likelyInfluence === "medium");
  const lowPriority = visibleSuggestions.filter(s => s.likelyInfluence === "low");

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div 
        className={cn(
          "fixed bottom-24 left-6 bg-background border border-border rounded-xl shadow-2xl transition-all duration-300 z-50",
          isMinimized ? "w-80 h-14" : "w-[400px] max-h-[calc(100vh-180px)]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500/10 rounded-lg">
              <UserPlus className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Missing Roles
                {visibleSuggestions.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {visibleSuggestions.length} suggested
                  </Badge>
                )}
              </h3>
              {!isMinimized && (
                <p className="text-xs text-muted-foreground">AI-detected gaps</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={fetchSuggestions}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggle}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <ScrollArea className="max-h-[calc(100vh-260px)]">
            <div className="p-4 space-y-4">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Analyzing org structure...</p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {data && !isLoading && (
                <>
                  {/* Department Gaps */}
                  {data.departmentGaps && data.departmentGaps.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Missing Departments
                      </h4>
                      {data.departmentGaps.map((gap, i) => (
                        <div key={i} className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{gap.department}</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{gap.reason}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {gap.suggestedRoles.map((role, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{role}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* High Priority Suggestions */}
                  {highPriority.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Shield className="w-3 h-3 text-red-500" />
                        High Impact Roles
                      </h4>
                      {highPriority.map(suggestion => (
                        <RoleSuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={() => handleDismiss(suggestion.id)}
                          onAdd={() => handleAddAsPlaceholder(suggestion)}
                          onExternalLookup={() => handleRequestExternalLookup(suggestion)}
                          onViewDetails={() => setSelectedRole(suggestion)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Medium Priority Suggestions */}
                  {mediumPriority.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Users className="w-3 h-3 text-amber-500" />
                        Medium Impact Roles
                      </h4>
                      {mediumPriority.map(suggestion => (
                        <RoleSuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={() => handleDismiss(suggestion.id)}
                          onAdd={() => handleAddAsPlaceholder(suggestion)}
                          onExternalLookup={() => handleRequestExternalLookup(suggestion)}
                          onViewDetails={() => setSelectedRole(suggestion)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Low Priority Suggestions */}
                  {lowPriority.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Info className="w-3 h-3 text-blue-500" />
                        Other Roles to Consider
                      </h4>
                      {lowPriority.map(suggestion => (
                        <RoleSuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          onDismiss={() => handleDismiss(suggestion.id)}
                          onAdd={() => handleAddAsPlaceholder(suggestion)}
                          onExternalLookup={() => handleRequestExternalLookup(suggestion)}
                          onViewDetails={() => setSelectedRole(suggestion)}
                          compact
                        />
                      ))}
                    </div>
                  )}

                  {visibleSuggestions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No missing roles detected</p>
                      <p className="text-xs">Org chart coverage looks comprehensive</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Role Details Dialog */}
      <Dialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedRole?.roleName}</DialogTitle>
            <DialogDescription>
              {selectedRole?.department} • {selectedRole?.seniority}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRole && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Why This Role Matters</h4>
                <p className="text-sm text-muted-foreground">{selectedRole.reason}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-1">Typical Responsibilities</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedRole.typicalResponsibilities.map((resp, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-1">Potential Concerns</h4>
                <p className="text-sm text-muted-foreground">{selectedRole.potentialConcerns}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-1">Suggested Approach</h4>
                <p className="text-sm text-muted-foreground">{selectedRole.suggestedApproach}</p>
              </div>

              {selectedRole.relatedExistingContacts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Related Contacts</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedRole.relatedExistingContacts.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedRole(null)}>
              Close
            </Button>
            {selectedRole && (
              <Button onClick={() => {
                handleAddAsPlaceholder(selectedRole);
                setSelectedRole(null);
              }}>
                Add as Placeholder
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* External Lookup Approval Dialog */}
      <Dialog open={showExternalLookupDialog} onOpenChange={setShowExternalLookupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              External Lookup Required
            </DialogTitle>
            <DialogDescription>
              To find specific people for this role, we need to search external sources.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{pendingLookupRole?.roleName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                at {account.name}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">This will:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Search LinkedIn for people with this title at {account.name}
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  Return potential matches for your review
                </li>
              </ul>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> External lookups use third-party services. 
                No data will be added automatically - you'll review all results first.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExternalLookupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmExternalLookup} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Approve & Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface RoleSuggestionCardProps {
  suggestion: RoleSuggestion;
  onDismiss: () => void;
  onAdd: () => void;
  onExternalLookup: () => void;
  onViewDetails: () => void;
  compact?: boolean;
}

function RoleSuggestionCard({ 
  suggestion, 
  onDismiss, 
  onAdd, 
  onExternalLookup,
  onViewDetails,
  compact 
}: RoleSuggestionCardProps) {
  const influenceColors = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{suggestion.roleName}</h4>
            <Badge className={cn("text-xs", influenceColors[suggestion.likelyInfluence])}>
              {suggestion.likelyInfluence}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {suggestion.department} • {suggestion.seniority}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <XCircle className="w-4 h-4" />
        </Button>
      </div>

      {!compact && (
        <p className="text-xs text-muted-foreground line-clamp-2">{suggestion.reason}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={onViewDetails}
        >
          Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onExternalLookup}
        >
          <ExternalLink className="w-3 h-3" />
          Find
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onAdd}
        >
          <UserPlus className="w-3 h-3" />
          Add
        </Button>
      </div>
    </div>
  );
}
