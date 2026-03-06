import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpDown, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmProjects } from "@/hooks/use-crm-projects";
import { AddEditProjectPanel } from "@/components/crm/AddEditProjectPanel";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

type SortKey = "name" | "status" | "project_type" | "budget" | "start_date";

export default function CrmProjectsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: projects = [], isLoading } = useCrmProjects({
    search: search || undefined,
    status: status || undefined,
  });

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [projects, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
    </TableHead>
  );

  const currencySymbol = (c: string) => c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CRM Projects</h1>
        </div>
        <Button onClick={() => setPanelOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Project
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={v => setStatus(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Statuses</SelectItem>
            {["active", "completed", "paused", "cancelled"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Project Name" k="name" />
              <TableHead>Company</TableHead>
              <SortHeader label="Type" k="project_type" />
              <SortHeader label="Status" k="status" />
              <SortHeader label="Budget" k="budget" />
              <TableHead>Assigned To</TableHead>
              <SortHeader label="Start Date" k="start_date" />
              <TableHead>End Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No projects found</TableCell></TableRow>
            ) : sorted.map(p => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/projects/${p.id}`)}>
                <TableCell className="font-medium text-primary">{p.name}</TableCell>
                <TableCell>
                  {p.crm_companies ? (
                    <span className="text-primary cursor-pointer hover:underline" onClick={e => { e.stopPropagation(); navigate(`/companies/${p.crm_companies!.id}`); }}>
                      {p.crm_companies.name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="capitalize">{p.project_type || "—"}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[p.status] || ""} variant="secondary">{p.status}</Badge>
                </TableCell>
                <TableCell>{p.budget != null ? `${currencySymbol(p.currency)}${p.budget.toLocaleString()}` : "—"}</TableCell>
                <TableCell>{p.assigned_to || "—"}</TableCell>
                <TableCell>{p.start_date ? format(new Date(p.start_date), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{p.end_date ? format(new Date(p.end_date), "dd MMM yyyy") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddEditProjectPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </div>
  );
}
