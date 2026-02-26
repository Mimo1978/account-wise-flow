import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpDown, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmCompanies, useSoftDeleteCrmCompany } from "@/hooks/use-crm-companies";
import { AddEditCompanyPanel } from "@/components/crm/AddEditCompanyPanel";
import { toast } from "@/hooks/use-toast";
import type { CrmCompany } from "@/types/crm";

type SortKey = "name" | "industry" | "size" | "city" | "created_at";

const INDUSTRIES = [
  "Technology", "Financial Services", "Healthcare", "Manufacturing",
  "Retail", "Professional Services", "Consulting", "Energy",
  "Telecommunications", "Education", "Real Estate", "Media", "Other",
];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const COUNTRIES = [
  "United Kingdom", "United States", "Germany", "France", "Netherlands",
  "Ireland", "Australia", "Canada", "Singapore", "India", "Other",
];

export default function CrmCompaniesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [size, setSize] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<CrmCompany | null>(null);

  const { data: companies = [], isLoading } = useCrmCompanies({
    search: search || undefined,
    industry: industry || undefined,
    country: country || undefined,
    size: size || undefined,
  });
  const softDelete = useSoftDeleteCrmCompany();

  const sorted = useMemo(() => {
    const arr = [...companies];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [companies, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleDelete = async (id: string) => {
    try {
      await softDelete.mutateAsync(id);
      toast({ title: "Company archived" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
    </TableHead>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CRM Companies</h1>
        </div>
        <Button onClick={() => { setEditCompany(null); setPanelOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Company
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search companies…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={industry} onValueChange={v => setIndustry(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Industries</SelectItem>
            {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={v => setCountry(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Countries</SelectItem>
            {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={size} onValueChange={v => setSize(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Size" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Sizes</SelectItem>
            {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Company Name" k="name" />
              <SortHeader label="Industry" k="industry" />
              <SortHeader label="Size" k="size" />
              <SortHeader label="City" k="city" />
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No companies found</TableCell></TableRow>
            ) : sorted.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/companies/${c.id}`)}>
                <TableCell className="font-medium text-primary">{c.name}</TableCell>
                <TableCell>{c.industry && <Badge variant="secondary">{c.industry}</Badge>}</TableCell>
                <TableCell>{c.size || "—"}</TableCell>
                <TableCell>{c.city || "—"}</TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditCompany(c); setPanelOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddEditCompanyPanel open={panelOpen} onOpenChange={setPanelOpen} company={editCompany} />
    </div>
  );
}
