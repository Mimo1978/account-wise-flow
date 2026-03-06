import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpDown, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmContacts, useSoftDeleteCrmContact, type CrmContactWithCompany } from "@/hooks/use-crm-contacts";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { AddEditContactPanel } from "@/components/crm/AddEditContactPanel";
import { toast } from "@/hooks/use-toast";

type SortKey = "last_name" | "email" | "job_title" | "created_at";

export default function CrmContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [gdprFilter, setGdprFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editContact, setEditContact] = useState<CrmContactWithCompany | null>(null);

  const { data: contacts = [], isLoading } = useCrmContacts({
    search: search || undefined,
    company_id: companyFilter || undefined,
    gdpr: gdprFilter as any || undefined,
  });
  const { data: companies = [] } = useCrmCompanies();
  const softDelete = useSoftDeleteCrmContact();

  const sorted = useMemo(() => {
    const arr = [...contacts];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [contacts, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleDelete = async (id: string) => {
    try {
      await softDelete.mutateAsync(id);
      toast({ title: "Contact archived" });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CRM Contacts</h1>
        </div>
        <Button onClick={() => { setEditContact(null); setPanelOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Contact
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={companyFilter} onValueChange={v => setCompanyFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={gdprFilter} onValueChange={v => setGdprFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Consent" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All</SelectItem>
            <SelectItem value="consented">Consented</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Full Name" k="last_name" />
              <TableHead>Company</TableHead>
              <SortHeader label="Job Title" k="job_title" />
              <SortHeader label="Email" k="email" />
              <TableHead>Phone</TableHead>
              <TableHead>GDPR</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No contacts found</TableCell></TableRow>
            ) : sorted.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                <TableCell className="font-medium text-primary">{c.first_name} {c.last_name}</TableCell>
                <TableCell>
                  {c.crm_companies ? (
                    <span
                      className="text-primary hover:underline cursor-pointer"
                      onClick={e => { e.stopPropagation(); navigate(`/companies/${c.crm_companies!.id}`); }}
                    >
                      {c.crm_companies.name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>{c.job_title || "—"}</TableCell>
                <TableCell>{c.email || "—"}</TableCell>
                <TableCell>{c.phone || c.mobile || "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.gdpr_consent ? "default" : "outline"} className={c.gdpr_consent ? "bg-success text-success-foreground" : ""}>
                    {c.gdpr_consent ? "Consented" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditContact(c); setPanelOpen(true); }}>
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

      <AddEditContactPanel open={panelOpen} onOpenChange={setPanelOpen} contact={editContact} />
    </div>
  );
}
