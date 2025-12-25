import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { mockAccount } from "@/lib/mock-data";
import { Contact } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactDetailPanel } from "@/components/canvas/ContactDetailPanel";
import {
  Search,
  Plus,
  Upload,
  Network,
  ArrowLeft,
} from "lucide-react";

const statusColors: Record<string, string> = {
  unknown: "bg-muted text-muted-foreground",
  new: "bg-blue-500/20 text-blue-400",
  warm: "bg-yellow-500/20 text-yellow-400",
  engaged: "bg-green-500/20 text-green-400",
  champion: "bg-purple-500/20 text-purple-400",
  blocker: "bg-red-500/20 text-red-400",
};

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

export default function ContactsDatabase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const allContacts = mockAccount.contacts;
  const companyName = mockAccount.name;

  // Get unique values for filters
  const departments = useMemo(() => {
    const depts = new Set(allContacts.map((c) => c.department));
    return Array.from(depts).sort();
  }, [allContacts]);

  const owners = useMemo(() => {
    const ownerSet = new Set(allContacts.map((c) => c.contactOwner).filter(Boolean));
    return Array.from(ownerSet).sort() as string[];
  }, [allContacts]);

  const statuses = ["unknown", "new", "warm", "engaged", "champion", "blocker"];

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return allContacts.filter((contact) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchLower) ||
        companyName.toLowerCase().includes(searchLower) ||
        contact.department.toLowerCase().includes(searchLower) ||
        contact.title.toLowerCase().includes(searchLower);

      const matchesDepartment =
        departmentFilter === "all" || contact.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;

      const matchesOwner =
        ownerFilter === "all" || contact.contactOwner === ownerFilter;

      return matchesSearch && matchesDepartment && matchesStatus && matchesOwner;
    });
  }, [allContacts, searchQuery, departmentFilter, statusFilter, ownerFilter, companyName]);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleViewOrgChart = () => {
    navigate("/canvas");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Contacts Database
                </h1>
                <p className="text-sm text-muted-foreground">
                  {companyName} • {filteredContacts.length} contacts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button variant="default" size="sm" onClick={handleViewOrgChart}>
                <Network className="h-4 w-4 mr-2" />
                View Org Chart
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, department, job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {owner}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Company</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Job Title</TableHead>
                <TableHead className="font-semibold">Seniority</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Owner</TableHead>
                <TableHead className="font-semibold">Last Contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(contact)}
                >
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{companyName}</TableCell>
                  <TableCell>{contact.department}</TableCell>
                  <TableCell>{contact.title}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {seniorityLabels[contact.seniority] || contact.seniority}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusColors[contact.status]}
                    >
                      {contact.status.charAt(0).toUpperCase() +
                        contact.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.contactOwner || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.lastContact || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No contacts found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contact Detail Dialog */}
      <Dialog
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <ContactDetailPanel
              contact={selectedContact}
              onClose={() => setSelectedContact(null)}
              isExpanded={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
