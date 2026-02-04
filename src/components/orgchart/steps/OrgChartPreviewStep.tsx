import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Users,
  MapPin,
  Briefcase,
  AlertTriangle,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgChartRow } from "../OrgChartBuilderModal";

interface OrgChartPreviewStepProps {
  extractedRows: OrgChartRow[];
  companyName?: string;
}

// Seniority level definitions for hierarchy inference
type SeniorityLevel = "c-level" | "evp-svp" | "vp-director" | "head" | "manager" | "senior" | "ic";

interface OrgNode {
  id: string;
  person?: OrgChartRow;
  isGhost: boolean;
  ghostTitle?: string;
  ghostDepartment?: string;
  seniorityLevel: SeniorityLevel;
  children: OrgNode[];
}

interface DepartmentTree {
  name: string;
  nodes: OrgNode[];
  missingRoles: string[];
}

// Title patterns for seniority detection
const SENIORITY_PATTERNS: Array<{ level: SeniorityLevel; patterns: RegExp[] }> = [
  {
    level: "c-level",
    patterns: [
      /^(chief|c[eiort]o|cfo|coo|cto|cio|ciso|cdo|cro|cco|chro)\b/i,
      /\b(chief)\s+(executive|financial|technology|information|operating|security|data|risk|compliance|human)/i,
    ],
  },
  {
    level: "evp-svp",
    patterns: [
      /^(evp|svp)\b/i,
      /\b(executive\s+vice\s+president|senior\s+vice\s+president)\b/i,
    ],
  },
  {
    level: "vp-director",
    patterns: [
      /^(vp|vice\s+president|director)\b/i,
      /\b(vice\s+president|director)\s+of\b/i,
    ],
  },
  {
    level: "head",
    patterns: [
      /^head\s+of\b/i,
      /\b(global\s+head|regional\s+head)\b/i,
    ],
  },
  {
    level: "manager",
    patterns: [
      /\bmanager\b/i,
      /\b(team\s+lead|tech\s+lead|engineering\s+lead)\b/i,
    ],
  },
  {
    level: "senior",
    patterns: [
      /^senior\b/i,
      /\b(sr\.?|principal|staff)\b/i,
    ],
  },
];

// Detect seniority level from job title
function detectSeniorityLevel(title: string): SeniorityLevel {
  const normalizedTitle = title.toLowerCase().trim();
  
  for (const { level, patterns } of SENIORITY_PATTERNS) {
    if (patterns.some((p) => p.test(normalizedTitle))) {
      return level;
    }
  }
  
  return "ic"; // Default to individual contributor
}

// Get seniority rank for sorting (lower = more senior)
function getSeniorityRank(level: SeniorityLevel): number {
  const ranks: Record<SeniorityLevel, number> = {
    "c-level": 0,
    "evp-svp": 1,
    "vp-director": 2,
    "head": 3,
    "manager": 4,
    "senior": 5,
    "ic": 6,
  };
  return ranks[level];
}

// Expected leadership roles per department
const EXPECTED_DEPARTMENT_LEADS: Record<string, string[]> = {
  "technology / engineering": ["CTO", "VP Engineering", "Head of Engineering"],
  "data / analytics": ["CDO", "Head of Data", "VP Data"],
  "product": ["CPO", "VP Product", "Head of Product"],
  "security / infosec": ["CISO", "Head of Security", "VP Security"],
  "finance": ["CFO", "VP Finance", "Head of Finance"],
  "risk": ["CRO", "Head of Risk", "VP Risk"],
  "compliance": ["CCO", "Head of Compliance", "VP Compliance"],
  "hr": ["CHRO", "VP HR", "Head of HR"],
  "operations": ["COO", "VP Operations", "Head of Operations"],
  "sales": ["CRO", "VP Sales", "Head of Sales"],
  "marketing": ["CMO", "VP Marketing", "Head of Marketing"],
};

// Check if department has leadership
function detectMissingLeadership(
  department: string,
  members: OrgChartRow[]
): string[] {
  const normalizedDept = department.toLowerCase();
  const expectedLeads = EXPECTED_DEPARTMENT_LEADS[normalizedDept] || [];
  
  if (expectedLeads.length === 0) return [];
  
  // Check if any member has a leadership title
  const hasLeader = members.some((m) => {
    const level = detectSeniorityLevel(m.job_title);
    return ["c-level", "evp-svp", "vp-director", "head"].includes(level);
  });
  
  if (hasLeader) return [];
  
  // Suggest the most appropriate missing role
  return [`Head of ${department.split("/")[0].trim()}`];
}

export function OrgChartPreviewStep({
  extractedRows,
  companyName,
}: OrgChartPreviewStepProps) {
  // Build hierarchical department trees with ghost nodes
  const { departmentTrees, executiveNodes, totalGhostNodes } = useMemo(() => {
    const deptMap = new Map<string, OrgChartRow[]>();
    const executives: OrgChartRow[] = [];
    
    // Group by department, extract C-level separately
    extractedRows.forEach((row) => {
      const level = detectSeniorityLevel(row.job_title);
      
      if (level === "c-level") {
        executives.push(row);
      } else {
        const dept = row.department || "Unassigned";
        if (!deptMap.has(dept)) {
          deptMap.set(dept, []);
        }
        deptMap.get(dept)!.push(row);
      }
    });
    
    let ghostCount = 0;
    
    // Build department trees
    const trees: DepartmentTree[] = Array.from(deptMap.entries())
      .map(([name, members]) => {
        // Sort members by seniority
        const sorted = [...members].sort((a, b) => {
          const levelA = getSeniorityRank(detectSeniorityLevel(a.job_title));
          const levelB = getSeniorityRank(detectSeniorityLevel(b.job_title));
          return levelA - levelB;
        });
        
        // Build hierarchy within department
        const nodes: OrgNode[] = sorted.map((person) => ({
          id: person.id,
          person,
          isGhost: false,
          seniorityLevel: detectSeniorityLevel(person.job_title),
          children: [],
        }));
        
        // Detect missing leadership
        const missingRoles = detectMissingLeadership(name, members);
        ghostCount += missingRoles.length;
        
        return { name, nodes, missingRoles };
      })
      .sort((a, b) => {
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
    
    // Build executive nodes
    const execNodes: OrgNode[] = executives.map((person) => ({
      id: person.id,
      person,
      isGhost: false,
      seniorityLevel: "c-level",
      children: [],
    }));
    
    return {
      departmentTrees: trees,
      executiveNodes: execNodes,
      totalGhostNodes: ghostCount,
    };
  }, [extractedRows]);

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set(extractedRows.map((r) => r.location).filter(Boolean));
    return Array.from(locs);
  }, [extractedRows]);

  return (
    <div className="space-y-4">
      {/* Preview Warning Banner */}
      <Alert className="border-warning/50 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-sm">
          <span className="font-medium">Preview only</span> — nothing saved until Confirm Import.
          Hierarchy is inferred from job titles and may require adjustment.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold">{extractedRows.length}</p>
            <p className="text-xs text-muted-foreground">People</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary">
            <Briefcase className="w-4 h-4 text-secondary-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold">{departmentTrees.length}</p>
            <p className="text-xs text-muted-foreground">Departments</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent">
            <MapPin className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold">{locations.length}</p>
            <p className="text-xs text-muted-foreground">Locations</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold truncate" title={companyName}>
              {companyName || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Company</p>
          </div>
        </div>
      </div>

      {/* Org Chart Preview */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Organization Chart Preview</h3>
            <p className="text-sm text-muted-foreground">
              Hierarchy inferred from job titles
            </p>
          </div>
          {totalGhostNodes > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
              <UserPlus className="w-3 h-3 mr-1" />
              {totalGhostNodes} suggested role{totalGhostNodes > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[320px]">
          <div className="p-4 space-y-6">
            {/* Executive Level */}
            {executiveNodes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Badge className="bg-primary/10 text-primary border-0">C-Level</Badge>
                  Executive Leadership
                </div>
                <div className="flex flex-wrap gap-3 ml-4">
                  {executiveNodes.map((node) => (
                    <PersonNode key={node.id} node={node} />
                  ))}
                </div>
              </div>
            )}

            {/* Department Trees */}
            {departmentTrees.map((dept) => (
              <DepartmentSection key={dept.name} department={dept} />
            ))}

            {extractedRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No people selected for import
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">
        Reporting lines are inferred from job titles. Ghost nodes indicate suggested leadership roles
        that can be filled later.
      </p>
    </div>
  );
}

// Department section with hierarchy
function DepartmentSection({ department }: { department: DepartmentTree }) {
  // Group nodes by seniority level for visual hierarchy
  const nodesByLevel = useMemo(() => {
    const levels: Record<string, OrgNode[]> = {
      leadership: [], // VP/Director/Head
      management: [], // Managers
      individual: [], // Senior/IC
    };
    
    department.nodes.forEach((node) => {
      if (["evp-svp", "vp-director", "head"].includes(node.seniorityLevel)) {
        levels.leadership.push(node);
      } else if (node.seniorityLevel === "manager") {
        levels.management.push(node);
      } else {
        levels.individual.push(node);
      }
    });
    
    return levels;
  }, [department.nodes]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium">{department.name}</h4>
        <Badge variant="secondary" className="text-xs">
          {department.nodes.length}
        </Badge>
      </div>

      <div className="ml-6 space-y-3">
        {/* Missing leadership ghost nodes */}
        {department.missingRoles.length > 0 && (
          <div className="space-y-2">
            {department.missingRoles.map((role) => (
              <GhostNode key={role} title={role} department={department.name} />
            ))}
          </div>
        )}

        {/* Leadership level */}
        {nodesByLevel.leadership.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium mb-1">Leadership</div>
            <div className="flex flex-wrap gap-2">
              {nodesByLevel.leadership.map((node) => (
                <PersonNode key={node.id} node={node} />
              ))}
            </div>
          </div>
        )}

        {/* Management level */}
        {nodesByLevel.management.length > 0 && (
          <div className="space-y-1">
            {nodesByLevel.leadership.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground ml-4">
                <ChevronRight className="w-3 h-3" />
              </div>
            )}
            <div className="text-xs text-muted-foreground font-medium mb-1 ml-4">Managers</div>
            <div className="flex flex-wrap gap-2 ml-4">
              {nodesByLevel.management.map((node) => (
                <PersonNode key={node.id} node={node} />
              ))}
            </div>
          </div>
        )}

        {/* Individual contributors */}
        {nodesByLevel.individual.length > 0 && (
          <div className="space-y-1">
            {(nodesByLevel.leadership.length > 0 || nodesByLevel.management.length > 0) && (
              <div className="flex items-center gap-1 text-muted-foreground ml-8">
                <ChevronRight className="w-3 h-3" />
              </div>
            )}
            <div className="text-xs text-muted-foreground font-medium mb-1 ml-8">Team Members</div>
            <div className="flex flex-wrap gap-2 ml-8">
              {nodesByLevel.individual.map((node) => (
                <PersonNode key={node.id} node={node} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Person node component
function PersonNode({ node }: { node: OrgNode }) {
  if (!node.person) return null;
  
  const initials = node.person.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const seniorityColors: Record<SeniorityLevel, string> = {
    "c-level": "bg-primary text-primary-foreground",
    "evp-svp": "bg-primary/80 text-primary-foreground",
    "vp-director": "bg-primary/60 text-primary-foreground",
    "head": "bg-secondary text-secondary-foreground",
    "manager": "bg-accent text-accent-foreground",
    "senior": "bg-muted text-muted-foreground",
    "ic": "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium",
          seniorityColors[node.seniorityLevel]
        )}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate max-w-[140px]">
          {node.person.full_name}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-[140px]">
          {node.person.job_title}
        </p>
      </div>
      {node.person.location && (
        <Badge variant="outline" className="shrink-0 text-xs ml-auto">
          {node.person.location}
        </Badge>
      )}
    </div>
  );
}

// Ghost node for missing roles
function GhostNode({ title, department }: { title: string; department: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-warning/50 bg-warning/5 hover:bg-warning/10 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-warning/50 text-warning">
        <UserPlus className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-warning-foreground">
          Missing: {title}
        </p>
        <p className="text-xs text-muted-foreground">
          Suggested role for {department}
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 text-xs ml-auto border-warning/30 text-warning-foreground">
        Ghost
      </Badge>
    </div>
  );
}
