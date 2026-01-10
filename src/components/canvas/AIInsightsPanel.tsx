import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Lightbulb, 
  RefreshCw, 
  X, 
  ChevronRight,
  AlertTriangle,
  Users,
  Building2,
  ShieldAlert,
  TrendingDown,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye
} from "lucide-react";
import { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InsightTheme {
  theme: string;
  description: string;
  evidence: string[];
  contactIds: string[];
}

interface MissingStakeholder {
  gap: string;
  reason: string;
  recommendation: string;
  relatedContactIds: string[];
}

interface DepartmentGap {
  department: string;
  issue: string;
  contactIds: string[];
  recommendation: string;
}

interface UnbalancedBlocker {
  blockerName: string;
  blockerId: string;
  concern: string;
  recommendation: string;
}

interface EngagementGap {
  area: string;
  contactIds: string[];
  recommendation: string;
}

interface AIInsights {
  repeatedThemes: InsightTheme[];
  missingStakeholders: MissingStakeholder[];
  departmentsWithoutOwners: DepartmentGap[];
  unbalancedBlockers: UnbalancedBlocker[];
  engagementGaps: EngagementGap[];
  summary: string;
}

interface AIInsightsPanelProps {
  account: Account;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightContacts: (contactIds: string[]) => void;
}

const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights-analysis`;

export function AIInsightsPanel({
  account,
  isOpen,
  onToggle,
  onHighlightContacts,
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const buildAccountContext = useCallback(() => {
    return {
      accountName: account.name,
      industry: account.industry,
      contacts: account.contacts.map(c => ({
        id: c.id,
        name: c.name,
        title: c.title,
        department: c.department,
        seniority: c.seniority,
        status: c.status,
        engagementScore: c.engagementScore,
        role: c.role,
        contactOwner: c.contactOwner,
        lastContact: c.lastContact,
        notes: c.notes?.map(n => ({ content: n.content, date: n.date, author: n.author })),
        activities: c.activities?.map(a => ({ type: a.type, date: a.date, description: a.description })),
      })),
      importantNote: account.importantNote,
    };
  }, [account]);

  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(INSIGHTS_URL, {
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

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setInsights(data);
    } catch (err) {
      console.error("AI insights error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch insights");
    } finally {
      setIsLoading(false);
    }
  }, [buildAccountContext]);

  useEffect(() => {
    if (isOpen && !insights && !isLoading) {
      fetchInsights();
    }
  }, [isOpen, insights, isLoading, fetchInsights]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleHighlight = (contactIds: string[]) => {
    onHighlightContacts(contactIds);
  };

  const getTotalInsightsCount = () => {
    if (!insights) return 0;
    return (
      insights.repeatedThemes.length +
      insights.missingStakeholders.length +
      insights.departmentsWithoutOwners.length +
      insights.unbalancedBlockers.length +
      insights.engagementGaps.length
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className={cn(
        "fixed top-20 right-6 bg-background border border-border rounded-xl shadow-2xl transition-all duration-300 z-50",
        isMinimized ? "w-80 h-14" : "w-[420px] max-h-[calc(100vh-180px)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Insights
              {insights && (
                <Badge variant="secondary" className="text-xs">
                  {getTotalInsightsCount()} findings
                </Badge>
              )}
            </h3>
            {!isMinimized && (
              <p className="text-xs text-muted-foreground">Opportunities & gaps</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchInsights}
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
                <p className="text-sm text-muted-foreground">Analyzing account...</p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {insights && !isLoading && (
              <>
                {/* Summary */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-900 dark:text-amber-100">{insights.summary}</p>
                </div>

                {/* Repeated Themes */}
                {insights.repeatedThemes.length > 0 && (
                  <InsightSection
                    title="Repeated Themes"
                    icon={<TrendingDown className="w-4 h-4" />}
                    count={insights.repeatedThemes.length}
                    isExpanded={expandedSections.has('themes')}
                    onToggle={() => toggleSection('themes')}
                    variant="info"
                  >
                    {insights.repeatedThemes.map((theme, i) => (
                      <InsightCard
                        key={i}
                        title={theme.theme}
                        description={theme.description}
                        details={theme.evidence}
                        contactIds={theme.contactIds}
                        onHighlight={handleHighlight}
                      />
                    ))}
                  </InsightSection>
                )}

                {/* Missing Stakeholders */}
                {insights.missingStakeholders.length > 0 && (
                  <InsightSection
                    title="Missing Stakeholders"
                    icon={<Users className="w-4 h-4" />}
                    count={insights.missingStakeholders.length}
                    isExpanded={expandedSections.has('stakeholders')}
                    onToggle={() => toggleSection('stakeholders')}
                    variant="warning"
                  >
                    {insights.missingStakeholders.map((gap, i) => (
                      <InsightCard
                        key={i}
                        title={gap.gap}
                        description={gap.reason}
                        recommendation={gap.recommendation}
                        contactIds={gap.relatedContactIds}
                        onHighlight={handleHighlight}
                      />
                    ))}
                  </InsightSection>
                )}

                {/* Departments Without Owners */}
                {insights.departmentsWithoutOwners.length > 0 && (
                  <InsightSection
                    title="Departments Without Owners"
                    icon={<Building2 className="w-4 h-4" />}
                    count={insights.departmentsWithoutOwners.length}
                    isExpanded={expandedSections.has('departments')}
                    onToggle={() => toggleSection('departments')}
                    variant="warning"
                  >
                    {insights.departmentsWithoutOwners.map((dept, i) => (
                      <InsightCard
                        key={i}
                        title={dept.department}
                        description={dept.issue}
                        recommendation={dept.recommendation}
                        contactIds={dept.contactIds}
                        onHighlight={handleHighlight}
                      />
                    ))}
                  </InsightSection>
                )}

                {/* Unbalanced Blockers */}
                {insights.unbalancedBlockers.length > 0 && (
                  <InsightSection
                    title="Blockers Without Counterbalance"
                    icon={<ShieldAlert className="w-4 h-4" />}
                    count={insights.unbalancedBlockers.length}
                    isExpanded={expandedSections.has('blockers')}
                    onToggle={() => toggleSection('blockers')}
                    variant="danger"
                  >
                    {insights.unbalancedBlockers.map((blocker, i) => (
                      <InsightCard
                        key={i}
                        title={blocker.blockerName}
                        description={blocker.concern}
                        recommendation={blocker.recommendation}
                        contactIds={[blocker.blockerId]}
                        onHighlight={handleHighlight}
                      />
                    ))}
                  </InsightSection>
                )}

                {/* Engagement Gaps */}
                {insights.engagementGaps.length > 0 && (
                  <InsightSection
                    title="Engagement Gaps"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    count={insights.engagementGaps.length}
                    isExpanded={expandedSections.has('engagement')}
                    onToggle={() => toggleSection('engagement')}
                    variant="warning"
                  >
                    {insights.engagementGaps.map((gap, i) => (
                      <InsightCard
                        key={i}
                        title={gap.area}
                        recommendation={gap.recommendation}
                        contactIds={gap.contactIds}
                        onHighlight={handleHighlight}
                      />
                    ))}
                  </InsightSection>
                )}

                {getTotalInsightsCount() === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No significant gaps detected</p>
                    <p className="text-xs">Account coverage looks healthy</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface InsightSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'info' | 'warning' | 'danger';
  children: React.ReactNode;
}

function InsightSection({ title, icon, count, isExpanded, onToggle, variant, children }: InsightSectionProps) {
  const variantStyles = {
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
          variantStyles[variant]
        )}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          </div>
          <ChevronRight className={cn(
            "w-4 h-4 transition-transform",
            isExpanded && "rotate-90"
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface InsightCardProps {
  title: string;
  description?: string;
  details?: string[];
  recommendation?: string;
  contactIds: string[];
  onHighlight: (contactIds: string[]) => void;
}

function InsightCard({ title, description, details, recommendation, contactIds, onHighlight }: InsightCardProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm">{title}</h4>
        {contactIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1 text-xs"
            onClick={() => onHighlight(contactIds)}
          >
            <Eye className="w-3 h-3" />
            View
          </Button>
        )}
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      {details && details.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {details.map((detail, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-primary">•</span>
              {detail}
            </li>
          ))}
        </ul>
      )}
      
      {recommendation && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs">
            <span className="font-medium text-primary">Recommendation:</span>{' '}
            <span className="text-muted-foreground">{recommendation}</span>
          </p>
        </div>
      )}
    </div>
  );
}
