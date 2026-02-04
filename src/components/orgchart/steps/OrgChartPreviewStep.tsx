import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  Users,
  MapPin,
  Briefcase,
  AlertTriangle,
  UserPlus,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  LayoutGrid,
  List,
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
  hasLeadership: boolean;
  ghostLeader?: { title: string };
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

// Get display label for seniority level
function getSeniorityLabel(level: SeniorityLevel): string {
  const labels: Record<SeniorityLevel, string> = {
    "c-level": "C-Suite",
    "evp-svp": "EVP/SVP",
    "vp-director": "VP/Director",
    "head": "Head",
    "manager": "Manager",
    "senior": "Senior",
    "ic": "Individual Contributor",
  };
  return labels[level];
}

// Map department name to suggested C-level or head role
function getSuggestedLeadRole(department: string): string {
  const deptLower = department.toLowerCase();
  
  const roleMap: Record<string, string> = {
    "technology": "Head of Technology",
    "engineering": "VP Engineering",
    "data": "Head of Data",
    "analytics": "Head of Analytics",
    "product": "Head of Product",
    "design": "Head of Design",
    "security": "Head of Security",
    "infosec": "CISO",
    "finance": "Head of Finance",
    "risk": "Head of Risk",
    "compliance": "Head of Compliance",
    "hr": "Head of HR",
    "people": "Head of People",
    "operations": "Head of Operations",
    "sales": "Head of Sales",
    "marketing": "Head of Marketing",
    "legal": "Head of Legal",
    "it": "Head of IT",
  };

  for (const [key, role] of Object.entries(roleMap)) {
    if (deptLower.includes(key)) {
      return role;
    }
  }
  
  // Generic fallback
  return `Head of ${department.split("/")[0].trim()}`;
}

// Check if department has leadership
function detectMissingLeadership(
  department: string,
  members: OrgChartRow[]
): { hasLeadership: boolean; suggestedRole?: string } {
  // Check if any member has a leadership title
  const hasLeader = members.some((m) => {
    const level = detectSeniorityLevel(m.job_title);
    return ["c-level", "evp-svp", "vp-director", "head"].includes(level);
  });
  
  if (hasLeader) {
    return { hasLeadership: true };
  }
  
  return {
    hasLeadership: false,
    suggestedRole: getSuggestedLeadRole(department),
  };
}

type ViewMode = "hierarchy" | "list";

export function OrgChartPreviewStep({
  extractedRows,
  companyName,
}: OrgChartPreviewStepProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("hierarchy");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Build hierarchical department trees with ghost nodes
  const { departmentTrees, executiveNodes, totalGhostNodes, stats } = useMemo(() => {
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
        const leadershipCheck = detectMissingLeadership(name, members);
        
        let ghostLeader: { title: string } | undefined;
        const missingRoles: string[] = [];
        
        if (!leadershipCheck.hasLeadership && leadershipCheck.suggestedRole && name !== "Unassigned") {
          ghostCount += 1;
          ghostLeader = { title: leadershipCheck.suggestedRole };
          missingRoles.push(leadershipCheck.suggestedRole);
        }
        
        return {
          name,
          nodes,
          missingRoles,
          hasLeadership: leadershipCheck.hasLeadership,
          ghostLeader,
        };
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
    
    // Calculate stats
    const locations = new Set(extractedRows.map((r) => r.location).filter(Boolean));
    const withEmail = extractedRows.filter((r) => r.email).length;
    const withPhone = extractedRows.filter((r) => r.phone || (r.phones && r.phones.length > 0)).length;
    
    return {
      departmentTrees: trees,
      executiveNodes: execNodes,
      totalGhostNodes: ghostCount,
      stats: {
        totalPeople: extractedRows.length,
        departments: trees.length,
        locations: locations.size,
        executives: execNodes.length,
        withEmail,
        withPhone,
      },
    };
  }, [extractedRows]);

  // Toggle department expansion
  const toggleDept = (deptName: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) {
        next.delete(deptName);
      } else {
        next.add(deptName);
      }
      return next;
    });
  };

  // Expand all departments
  const expandAll = () => {
    setExpandedDepts(new Set(departmentTrees.map((d) => d.name)));
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedDepts(new Set());
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          value={stats.totalPeople}
          label="People"
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          icon={Briefcase}
          value={stats.departments}
          label="Departments"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
        />
        <StatCard
          icon={MapPin}
          value={stats.locations}
          label="Locations"
          iconBg="bg-accent"
          iconColor="text-accent-foreground"
        />
        <StatCard
          icon={Building2}
          value={companyName || "—"}
          label="Company"
          iconBg="bg-muted"
          iconColor="text-muted-foreground"
          isText
        />
      </div>

      {/* Contact Info Stats (if applicable) */}
      {(stats.withEmail > 0 || stats.withPhone > 0) && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {stats.withEmail > 0 && (
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              {stats.withEmail} with email
            </span>
          )}
          {stats.withPhone > 0 && (
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              {stats.withPhone} with phone
            </span>
          )}
        </div>
      )}

      {/* Org Chart Preview */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Organization Chart Preview</h3>
            <p className="text-sm text-muted-foreground">
              Hierarchy inferred from job titles • Clustered by department
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalGhostNodes > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
                <UserPlus className="w-3 h-3 mr-1" />
                {totalGhostNodes} placeholder{totalGhostNodes > 1 ? "s" : ""}
              </Badge>
            )}
            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 rounded-r-none", viewMode === "hierarchy" && "bg-muted")}
                onClick={() => setViewMode("hierarchy")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 rounded-l-none", viewMode === "list" && "bg-muted")}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Expand/Collapse Controls */}
        {viewMode === "hierarchy" && departmentTrees.length > 1 && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        )}

        <ScrollArea className="h-[320px]">
          <div className="p-4 space-y-4">
            {viewMode === "hierarchy" ? (
              <>
                {/* Executive Level */}
                {executiveNodes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Badge className="bg-primary/10 text-primary border-0">C-Level</Badge>
                      Executive Leadership
                    </div>
                    <div className="flex flex-wrap gap-3 ml-4">
                      {executiveNodes.map((node) => (
                        <PersonNode key={node.id} node={node} showDetails />
                      ))}
                    </div>
                    {/* Connector line to departments */}
                    {departmentTrees.length > 0 && (
                      <div className="flex items-center gap-2 ml-8 pt-2">
                        <div className="w-0.5 h-4 bg-border" />
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}

                {/* Department Trees */}
                {departmentTrees.map((dept) => (
                  <DepartmentSection
                    key={dept.name}
                    department={dept}
                    isExpanded={expandedDepts.has(dept.name)}
                    onToggle={() => toggleDept(dept.name)}
                  />
                ))}
              </>
            ) : (
              /* List View */
              <div className="space-y-3">
                {extractedRows.map((row) => (
                  <ListViewRow key={row.id} row={row} />
                ))}
              </div>
            )}

            {extractedRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No people selected for import
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">
        Reporting lines are inferred from job titles. Placeholder nodes indicate suggested leadership roles
        that can be filled later.
      </p>
    </div>
  );
}

// Stat card component
function StatCard({
  icon: Icon,
  value,
  label,
  iconBg,
  iconColor,
  isText,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  iconBg: string;
  iconColor: string;
  isText?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div className="min-w-0">
        {isText ? (
          <p className="text-sm font-semibold truncate" title={String(value)}>
            {value}
          </p>
        ) : (
          <p className="text-xl font-bold">{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Department section with hierarchy
function DepartmentSection({
  department,
  isExpanded,
  onToggle,
}: {
  department: DepartmentTree;
  isExpanded: boolean;
  onToggle: () => void;
}) {
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

  const totalCount = department.nodes.length + (department.ghostLeader ? 1 : 0);

  return (
    <div className="space-y-2 border rounded-lg bg-card/50">
      {/* Department Header */}
      <button
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 rounded-t-lg transition-colors"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )}
        />
        <Briefcase className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium flex-1 text-left">{department.name}</h4>
        <div className="flex items-center gap-2">
          {department.ghostLeader && (
            <Badge variant="outline" className="text-xs border-warning/30 text-warning bg-warning/5">
              <UserPlus className="w-3 h-3 mr-1" />
              Needs lead
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {totalCount}
          </Badge>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Ghost Leader (placeholder head) */}
          {department.ghostLeader && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Suggested Leader</div>
              <GhostNode title={department.ghostLeader.title} department={department.name} />
            </div>
          )}

          {/* Leadership level */}
          {nodesByLevel.leadership.length > 0 && (
            <HierarchyLevel
              label="Leadership"
              nodes={nodesByLevel.leadership}
              depth={0}
            />
          )}

          {/* Management level */}
          {nodesByLevel.management.length > 0 && (
            <HierarchyLevel
              label="Managers"
              nodes={nodesByLevel.management}
              depth={nodesByLevel.leadership.length > 0 ? 1 : 0}
              showConnector={nodesByLevel.leadership.length > 0 || !!department.ghostLeader}
            />
          )}

          {/* Individual contributors */}
          {nodesByLevel.individual.length > 0 && (
            <HierarchyLevel
              label="Team Members"
              nodes={nodesByLevel.individual}
              depth={
                nodesByLevel.leadership.length > 0 || nodesByLevel.management.length > 0
                  ? nodesByLevel.management.length > 0 ? 2 : 1
                  : 0
              }
              showConnector={
                nodesByLevel.leadership.length > 0 ||
                nodesByLevel.management.length > 0 ||
                !!department.ghostLeader
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

// Hierarchy level component
function HierarchyLevel({
  label,
  nodes,
  depth,
  showConnector,
}: {
  label: string;
  nodes: OrgNode[];
  depth: number;
  showConnector?: boolean;
}) {
  const marginLeft = depth * 16; // 16px per level

  return (
    <div className="space-y-1" style={{ marginLeft: `${marginLeft}px` }}>
      {showConnector && (
        <div className="flex items-center gap-1 text-muted-foreground mb-1">
          <div className="w-0.5 h-3 bg-border" />
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {nodes.map((node) => (
          <PersonNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

// Person node component
function PersonNode({ node, showDetails }: { node: OrgNode; showDetails?: boolean }) {
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

  const hasContactInfo = node.person.email || node.person.phone;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-default">
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium shrink-0",
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
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {hasContactInfo && (
                <div className="flex items-center gap-0.5">
                  {node.person.email && (
                    <Mail className="w-3 h-3 text-muted-foreground" />
                  )}
                  {node.person.phone && (
                    <Phone className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              )}
              {showDetails && node.person.location && (
                <Badge variant="outline" className="text-xs">
                  {node.person.location}
                </Badge>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{node.person.full_name}</p>
            <p className="text-sm text-muted-foreground">{node.person.job_title}</p>
            {node.person.department && (
              <p className="text-sm">{node.person.department}</p>
            )}
            {node.person.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {node.person.location}
              </p>
            )}
            {node.person.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /> {node.person.email}
              </p>
            )}
            {node.person.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> {node.person.phone}
              </p>
            )}
            <Badge variant="secondary" className="text-xs mt-1">
              {getSeniorityLabel(node.seniorityLevel)}
            </Badge>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Ghost node for missing roles
function GhostNode({ title, department }: { title: string; department: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-warning/50 bg-warning/5 hover:bg-warning/10 transition-colors">
      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-warning/50 text-warning shrink-0">
        <UserPlus className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-warning-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          Placeholder — fill after import
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 text-xs ml-auto border-warning/30 text-warning-foreground bg-warning/10">
        Ghost
      </Badge>
    </div>
  );
}

// List view row
function ListViewRow({ row }: { row: OrgChartRow }) {
  const level = detectSeniorityLevel(row.job_title);
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-card">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{row.full_name}</p>
        <p className="text-xs text-muted-foreground">{row.job_title}</p>
      </div>
      <Badge variant="secondary" className="shrink-0 text-xs">
        {row.department || "Unassigned"}
      </Badge>
      {row.location && (
        <Badge variant="outline" className="shrink-0 text-xs">
          <MapPin className="w-3 h-3 mr-1" />
          {row.location}
        </Badge>
      )}
      <Badge variant="outline" className="shrink-0 text-xs">
        {getSeniorityLabel(level)}
      </Badge>
    </div>
  );
}
