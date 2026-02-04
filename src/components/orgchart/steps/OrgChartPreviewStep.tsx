import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Users, MapPin, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgChartRow } from "../OrgChartBuilderModal";

interface OrgChartPreviewStepProps {
  extractedRows: OrgChartRow[];
  companyName?: string;
}

interface DepartmentGroup {
  name: string;
  members: OrgChartRow[];
}

export function OrgChartPreviewStep({
  extractedRows,
  companyName,
}: OrgChartPreviewStepProps) {
  // Group by department
  const departmentGroups = useMemo(() => {
    const groups = new Map<string, OrgChartRow[]>();

    extractedRows.forEach((row) => {
      const dept = row.department || "Unassigned";
      if (!groups.has(dept)) {
        groups.set(dept, []);
      }
      groups.get(dept)!.push(row);
    });

    return Array.from(groups.entries())
      .map(([name, members]) => ({ name, members }))
      .sort((a, b) => {
        // Put "Unassigned" last
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [extractedRows]);

  // Get unique locations
  const locations = useMemo(() => {
    const locs = new Set(extractedRows.map((r) => r.location).filter(Boolean));
    return Array.from(locs);
  }, [extractedRows]);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{extractedRows.length}</p>
            <p className="text-xs text-muted-foreground">People</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{departmentGroups.length}</p>
            <p className="text-xs text-muted-foreground">Departments</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
            <MapPin className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{locations.length}</p>
            <p className="text-xs text-muted-foreground">Locations</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10">
            <Building2 className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <p className="text-lg font-semibold truncate" title={companyName}>
              {companyName || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Company</p>
          </div>
        </div>
      </div>

      {/* Org Chart Preview - Simple Tree View */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/50">
          <h3 className="font-medium">Organization Preview</h3>
          <p className="text-sm text-muted-foreground">
            Grouped by department
          </p>
        </div>

        <ScrollArea className="h-[280px]">
          <div className="p-4 space-y-4">
            {departmentGroups.map((group) => (
              <div key={group.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-medium">{group.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {group.members.length}
                  </Badge>
                </div>

                <div className="ml-6 space-y-1">
                  {group.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {member.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.job_title || "No title"}
                        </p>
                      </div>
                      {member.location && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {member.location}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
        This preview shows how contacts will be organized. The actual canvas layout may differ.
      </p>
    </div>
  );
}
