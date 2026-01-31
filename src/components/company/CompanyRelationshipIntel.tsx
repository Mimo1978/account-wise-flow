import { Account } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle2,
  Users,
  TrendingUp,
  AlertTriangle,
  Star,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyRelationshipIntelProps {
  company: Account;
}

interface DepartmentCoverage {
  name: string;
  count: number;
  hasExecutive: boolean;
  hasChampion: boolean;
}

export function CompanyRelationshipIntel({ company }: CompanyRelationshipIntelProps) {
  // Analyze department coverage
  const departmentMap = new Map<string, DepartmentCoverage>();
  
  company.contacts.forEach((contact) => {
    const dept = contact.department || "Other";
    const existing = departmentMap.get(dept) || { 
      name: dept, 
      count: 0, 
      hasExecutive: false, 
      hasChampion: false 
    };
    
    existing.count += 1;
    if (contact.seniority === "executive" || contact.seniority === "director") {
      existing.hasExecutive = true;
    }
    if (contact.status === "champion") {
      existing.hasChampion = true;
    }
    
    departmentMap.set(dept, existing);
  });
  
  const departments = Array.from(departmentMap.values()).sort((a, b) => b.count - a.count);
  
  // Calculate coverage metrics
  const executiveCount = company.contacts.filter(
    (c) => c.seniority === "executive" || c.seniority === "director"
  ).length;
  const championCount = company.contacts.filter((c) => c.status === "champion").length;
  const blockerCount = company.knownBlockers?.length || 0;
  const engagedCount = company.contacts.filter(
    (c) => c.status === "engaged" || c.status === "champion" || c.status === "warm"
  ).length;
  
  const coverageScore = Math.min(
    100,
    Math.round(
      (departments.length * 15) +
      (executiveCount * 20) +
      (championCount * 25) -
      (blockerCount * 10)
    )
  );
  
  // Generate AI insights
  const insights: { type: "success" | "warning" | "danger"; text: string }[] = [];
  
  if (championCount > 0) {
    insights.push({
      type: "success",
      text: `${championCount} identified champion${championCount > 1 ? "s" : ""} driving engagement`,
    });
  }
  
  if (executiveCount === 0) {
    insights.push({
      type: "warning",
      text: "No executive sponsor identified — consider executive outreach",
    });
  } else {
    insights.push({
      type: "success",
      text: `${executiveCount} executive-level relationship${executiveCount > 1 ? "s" : ""} established`,
    });
  }
  
  if (departments.length < 2) {
    insights.push({
      type: "warning",
      text: "Limited departmental coverage — expand across functions",
    });
  } else if (departments.length >= 3) {
    insights.push({
      type: "success",
      text: `Strong presence across ${departments.length} departments`,
    });
  }
  
  if (blockerCount > 0) {
    insights.push({
      type: "danger",
      text: `${blockerCount} known blocker${blockerCount > 1 ? "s" : ""} — risk mitigation needed`,
    });
  }
  
  return (
    <div className="space-y-6">
      {/* Coverage Score */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Coverage Score</span>
          <span className="text-muted-foreground">{coverageScore}/100</span>
        </div>
        <Progress value={coverageScore} className="h-2" />
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Departments</p>
            <p className="font-semibold">{departments.length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Star className="h-4 w-4 text-accent-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Champions</p>
          <p className="font-semibold">{championCount}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Building2 className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Executives</p>
          <p className="font-semibold">{executiveCount}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <TrendingUp className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Engaged</p>
            <p className="font-semibold">{engagedCount}</p>
          </div>
        </div>
      </div>
      
      {/* Department Coverage */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Department Coverage</p>
        <div className="flex flex-wrap gap-2">
          {departments.map((dept) => (
            <Badge
              key={dept.name}
              variant={dept.hasChampion ? "default" : "secondary"}
            className={cn(
              "gap-1.5",
              dept.hasChampion && "bg-accent text-accent-foreground hover:bg-accent/80",
              dept.hasExecutive && !dept.hasChampion && "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            >
              {dept.hasChampion && <Star className="h-3 w-3" />}
              {dept.name}
              <span className="text-xs opacity-70">({dept.count})</span>
            </Badge>
          ))}
        </div>
      </div>
      
      {/* AI Insights */}
      <div className="space-y-2">
        <p className="text-sm font-medium">AI Insights</p>
        <div className="space-y-2">
          {insights.map((insight, index) => (
            <div
              key={index}
            className={cn(
              "flex items-start gap-2 p-2.5 rounded-lg text-sm",
              insight.type === "success" && "bg-accent text-accent-foreground",
              insight.type === "warning" && "bg-secondary text-secondary-foreground",
              insight.type === "danger" && "bg-destructive/10 text-destructive"
              )}
            >
              {insight.type === "success" && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
              {insight.type === "warning" && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
              {insight.type === "danger" && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
