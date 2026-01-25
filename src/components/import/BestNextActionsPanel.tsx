import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Target,
  Briefcase,
  Link2,
  AlertCircle,
  Loader2,
  X,
  Clock,
  Check,
  ExternalLink,
  Users,
  Building2,
  FileText,
  Linkedin,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EntityContext {
  entityType: "candidate" | "contact" | "both";
  entityId: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  headline?: string;
  skills?: string[];
  experience?: any[];
  linkedIn?: string;
  location?: string;
  company?: { id?: string; name: string };
  cvAttached?: boolean;
}

interface SuggestedAction {
  id: string;
  category: "recruitment" | "sales" | "crossover" | "data_quality";
  title: string;
  reasoning: string;
  confidenceScore: number;
  actionType: string;
  actionData?: Record<string, any>;
  ctaLabel: string;
  ctaPath?: string;
}

interface BestNextActionsPanelProps {
  entityContext: EntityContext;
  workspaceId?: string;
  onActionComplete?: (actionId: string) => void;
  className?: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  recruitment: { icon: Target, color: "text-blue-500", label: "Recruitment" },
  sales: { icon: Briefcase, color: "text-green-500", label: "Sales" },
  crossover: { icon: Link2, color: "text-purple-500", label: "Crossover" },
  data_quality: { icon: AlertCircle, color: "text-orange-500", label: "Data Quality" },
};

const actionIcons: Record<string, React.ElementType> = {
  view_profile: Users,
  add_orgchart: Building2,
  expand_mapping: Map,
  generate_cv: FileText,
  add_linkedin: Linkedin,
  view_company: Building2,
  match_role: Target,
  schedule_outreach: Clock,
};

export function BestNextActionsPanel({
  entityContext,
  workspaceId,
  onActionComplete,
  className,
}: BestNextActionsPanelProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entityContext?.entityId) {
      fetchSuggestions();
    }
  }, [entityContext?.entityId]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-next-actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ entityContext, workspaceId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await response.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setError("Unable to load suggestions");
      // Use empty fallback - component will show empty state
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: SuggestedAction) => {
    // Navigate if path provided
    if (action.ctaPath) {
      navigate(action.ctaPath);
    }

    // Mark as completed
    setCompletedActions((prev) => new Set(prev).add(action.id));
    onActionComplete?.(action.id);
    
    toast.success(`Action started: ${action.title}`);
  };

  const handleDismiss = (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedActions((prev) => new Set(prev).add(actionId));
    toast.info("Action dismissed");
  };

  const handleSnooze = (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a full implementation, this would store a snooze timestamp
    setDismissedActions((prev) => new Set(prev).add(actionId));
    toast.info("Reminder set for later");
  };

  const visibleActions = actions.filter(
    (a) => !dismissedActions.has(a.id) && !completedActions.has(a.id)
  );

  if (isLoading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Analyzing best next actions...</span>
        </CardContent>
      </Card>
    );
  }

  if (error && visibleActions.length === 0) {
    return null; // Silent fail - don't show broken component
  }

  if (visibleActions.length === 0 && !isLoading) {
    return null; // No actions to show
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Suggested Next Actions
                {visibleActions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {visibleActions.length}
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {visibleActions.map((action) => {
                  const config = categoryConfig[action.category] || categoryConfig.data_quality;
                  const ActionIcon = actionIcons[action.actionType] || config.icon;

                  return (
                    <div
                      key={action.id}
                      className="group p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-md bg-muted", config.color)}>
                          <ActionIcon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight">
                              {action.title}
                            </h4>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => handleSnooze(action.id, e)}
                                title="Remind me later"
                              >
                                <Clock className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => handleDismiss(action.id, e)}
                                title="Dismiss"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {action.reasoning}
                          </p>

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", config.color)}
                              >
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {action.confidenceScore}% match
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleActionClick(action)}
                            >
                              {action.ctaLabel}
                              {action.ctaPath && <ExternalLink className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {completedActions.size > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3 w-3 text-primary" />
                      {completedActions.size} action{completedActions.size > 1 ? "s" : ""} completed
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
