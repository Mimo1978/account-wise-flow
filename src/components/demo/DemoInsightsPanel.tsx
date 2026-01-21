import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ChevronRight,
  Lightbulb,
  Users,
  Target,
  TrendingUp,
  X,
  Sparkles,
} from "lucide-react";
import { DemoInsight } from "@/lib/demo-scenarios";

interface DemoInsightsPanelProps {
  insights: DemoInsight[];
  isOpen: boolean;
  onClose: () => void;
  onHighlightContacts?: (contactIds: string[]) => void;
}

const getInsightIcon = (type: DemoInsight["type"]) => {
  switch (type) {
    case "risk":
      return AlertTriangle;
    case "coverage-gap":
      return Target;
    case "opportunity":
      return TrendingUp;
    case "talent":
      return Users;
    case "action":
    default:
      return Lightbulb;
  }
};

const getSeverityColor = (severity: DemoInsight["severity"]) => {
  switch (severity) {
    case "critical":
      return "bg-red-50 border-red-200 text-red-700";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-700";
    case "info":
    default:
      return "bg-blue-50 border-blue-200 text-blue-700";
  }
};

const getSeverityBadge = (severity: DemoInsight["severity"]) => {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    case "warning":
      return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Warning</Badge>;
    case "info":
    default:
      return <Badge variant="secondary" className="text-xs">Info</Badge>;
  }
};

export const DemoInsightsPanel = ({
  insights,
  isOpen,
  onClose,
  onHighlightContacts,
}: DemoInsightsPanelProps) => {
  if (!isOpen) return null;

  const handleInsightClick = (insight: DemoInsight) => {
    if (insight.relatedContactIds && onHighlightContacts) {
      onHighlightContacts(insight.relatedContactIds);
    }
  };

  // Sort by severity: critical first, then warning, then info
  const sortedInsights = [...insights].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="fixed right-4 top-[180px] w-96 bg-background border border-border rounded-xl shadow-xl z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Demo Insights</h3>
            <p className="text-xs text-muted-foreground">{insights.length} AI-generated insights</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Insights List */}
      <ScrollArea className="h-[400px]">
        <div className="p-3 space-y-3">
          {sortedInsights.map((insight) => {
            const Icon = getInsightIcon(insight.type);
            return (
              <div
                key={insight.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getSeverityColor(insight.severity)}`}
                onClick={() => handleInsightClick(insight)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-background/80">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{insight.title}</span>
                      {getSeverityBadge(insight.severity)}
                    </div>
                    <p className="text-xs opacity-80 mb-2">{insight.description}</p>
                    
                    {insight.recommendedActions && insight.recommendedActions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current/10">
                        <span className="text-xs font-medium opacity-70">Recommended:</span>
                        <ul className="mt-1 space-y-1">
                          {insight.recommendedActions.slice(0, 2).map((action, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-xs opacity-80">
                              <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>{action}</span>
                            </li>
                          ))}
                          {insight.recommendedActions.length > 2 && (
                            <li className="text-xs opacity-60">
                              +{insight.recommendedActions.length - 2} more actions
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {insight.relatedContactIds && insight.relatedContactIds.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs opacity-70">
                        <Users className="w-3 h-3" />
                        <span>Click to highlight {insight.relatedContactIds.length} contact(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 text-center">
        <span className="text-xs text-muted-foreground">
          ✨ Demo Insight — AI analysis of scenario data
        </span>
      </div>
    </div>
  );
};
