import { Contact } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingDown, 
  Calendar, 
  Bell, 
  Lightbulb,
  ArrowRight,
  Clock,
  Users,
  Target,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface ContactInsightsTabProps {
  contact: Contact;
}

interface Insight {
  id: string;
  type: "risk" | "gap" | "reminder" | "opportunity" | "action";
  severity: "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  actionLabel?: string;
}

const severityConfig = {
  high: { className: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  medium: { className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  low: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Bell },
  info: { className: "bg-muted text-muted-foreground border-border", icon: Lightbulb },
};

const typeConfig = {
  risk: { label: "Risk", icon: AlertTriangle },
  gap: { label: "Gap", icon: Users },
  reminder: { label: "Follow-up", icon: Calendar },
  opportunity: { label: "Opportunity", icon: Target },
  action: { label: "Suggested Action", icon: CheckCircle2 },
};

export function ContactInsightsTab({ contact }: ContactInsightsTabProps) {
  // Generate insights based on contact data
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    // Check for stale engagement
    if (contact.lastContact) {
      const lastContactDate = new Date(contact.lastContact);
      const daysSinceContact = Math.floor((Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceContact > 30) {
        insights.push({
          id: "stale-engagement",
          type: "risk",
          severity: daysSinceContact > 60 ? "high" : "medium",
          title: "Relationship Cooling",
          description: `No contact in ${daysSinceContact} days. Consider reaching out to maintain the relationship.`,
          actionLabel: "Schedule Follow-up",
        });
      }
    }

    // Check for missing role
    if (!contact.role) {
      insights.push({
        id: "missing-role",
        type: "gap",
        severity: "medium",
        title: "Buying Role Not Assigned",
        description: "Assigning a buying role helps prioritize engagement and understand decision dynamics.",
        actionLabel: "Assign Role",
      });
    }

    // Check for champion/blocker status
    if (contact.status === "champion") {
      insights.push({
        id: "champion-leverage",
        type: "opportunity",
        severity: "info",
        title: "Champion Leverage",
        description: "This contact is a champion. Consider involving them in internal advocacy or referral opportunities.",
      });
    }

    if (contact.status === "blocker") {
      insights.push({
        id: "blocker-strategy",
        type: "risk",
        severity: "high",
        title: "Blocker Identified",
        description: "This contact may be blocking progress. Develop a mitigation strategy or find alternative paths.",
        actionLabel: "View Strategies",
      });
    }

    // Check for low engagement score
    if (contact.engagementScore && contact.engagementScore < 40) {
      insights.push({
        id: "low-engagement",
        type: "risk",
        severity: "medium",
        title: "Low Engagement Score",
        description: `Engagement score is ${contact.engagementScore}%. Increase touchpoints or review value proposition.`,
        actionLabel: "View Activity History",
      });
    }

    // Suggested next actions
    insights.push({
      id: "suggested-followup",
      type: "action",
      severity: "info",
      title: "Suggested Next Action",
      description: contact.status === "warm" 
        ? "Send a personalized update or share relevant industry insights to deepen engagement."
        : contact.status === "engaged"
        ? "Schedule a strategy review meeting to discuss upcoming initiatives."
        : "Schedule an introductory call to understand current priorities.",
    });

    // Add mock placement expiry warning
    insights.push({
      id: "placement-expiry",
      type: "reminder",
      severity: "medium",
      title: "Placement Ending Soon",
      description: "Emily Chen's placement ends in 3 weeks. Discuss extension or replacement options.",
      actionLabel: "View Placement",
    });

    return insights;
  };

  const insights = generateInsights();

  const handleAction = (insight: Insight) => {
    toast.info(`Action: ${insight.actionLabel || insight.title}`);
  };

  const riskInsights = insights.filter(i => i.type === "risk" || i.severity === "high");
  const actionInsights = insights.filter(i => i.type === "action" || i.type === "opportunity");
  const otherInsights = insights.filter(i => !riskInsights.includes(i) && !actionInsights.includes(i));

  return (
    <div className="space-y-6">
      {/* AI Insights Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">AI Relationship Insights</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {insights.length} insights
        </Badge>
      </div>

      {/* Risk Indicators */}
      {riskInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Risks & Warnings
          </h4>
          {riskInsights.map((insight) => {
            const severity = severityConfig[insight.severity];
            const type = typeConfig[insight.type];
            const Icon = severity.icon;
            
            return (
              <Card key={insight.id} className={`border ${insight.severity === "high" ? "border-red-500/30" : "border-amber-500/30"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${insight.severity === "high" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <Badge variant="outline" className={severity.className}>
                          {insight.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.actionLabel && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="mt-2 h-7 px-2"
                          onClick={() => handleAction(insight)}
                        >
                          {insight.actionLabel}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Suggested Actions */}
      {actionInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Suggested Actions
          </h4>
          {actionInsights.map((insight) => {
            const type = typeConfig[insight.type];
            const Icon = type.icon;
            
            return (
              <Card key={insight.id} className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Other Insights */}
      {otherInsights.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Follow-ups & Gaps
          </h4>
          {otherInsights.map((insight) => {
            const severity = severityConfig[insight.severity];
            const type = typeConfig[insight.type];
            const Icon = type.icon;
            
            return (
              <Card key={insight.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {type.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.actionLabel && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="mt-2 h-7 px-2"
                          onClick={() => handleAction(insight)}
                        >
                          {insight.actionLabel}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {insights.length === 0 && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No insights available yet. Add more activity to generate AI recommendations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
