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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ContactDetailPanel } from "@/components/canvas/ContactDetailPanel";
import {
  Search,
  Plus,
  Upload,
  Network,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// Helper to check data quality
const isContactReady = (contact: Contact): boolean => {
  return Boolean(contact.department && contact.department.trim() !== "" && contact.title && contact.title.trim() !== "");
};

// Available options for dropdowns
const departmentOptions = [
  "Engineering",
  "Product",
  "Sales",
  "Marketing",
  "Finance",
  "Operations",
  "Legal",
  "Human Resources",
  "Customer Success",
  "Executive",
];

const jobTitleOptions = [
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "VP of Engineering",
  "VP of Sales",
  "VP of Marketing",
  "VP of Product",
  "Director",
  "Senior Manager",
  "Manager",
  "Senior Engineer",
  "Engineer",
  "Analyst",
  "Associate",
  "Coordinator",
];

const seniorityOptions = [
  { value: "executive", label: "Executive" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "mid", label: "Mid-Level" },
  { value: "junior", label: "Junior" },
];

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

  const handleRowClick = (contact: Contact, e: React.MouseEvent) => {
    // Don't open detail if clicking on data quality actions
    if ((e.target as HTMLElement).closest('[data-quality-action]')) {
      return;
    }
    setSelectedContact(contact);
  };

  const handleViewOrgChart = () => {
    navigate("/canvas");
  };

  // State for assign modal
  const [assignContact, setAssignContact] = useState<Contact | null>(null);
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignJobTitle, setAssignJobTitle] = useState("");
  const [assignSeniority, setAssignSeniority] = useState("");

  const handleOpenAssign = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignContact(contact);
    setAssignDepartment(contact.department || "");
    setAssignJobTitle(contact.title || "");
    setAssignSeniority(contact.seniority || "");
  };

  const handleSaveAssignment = () => {
    if (!assignContact) return;
    
    // Validate required fields
    if (!assignDepartment || !assignJobTitle) {
      return; // Don't save if missing required fields
    }

    // Update the contact in mock data (in real app, this would be an API call)
    const contactIndex = mockAccount.contacts.findIndex(c => c.id === assignContact.id);
    if (contactIndex !== -1) {
      mockAccount.contacts[contactIndex] = {
        ...mockAccount.contacts[contactIndex],
        department: assignDepartment,
        title: assignJobTitle,
        seniority: assignSeniority as Contact["seniority"] || mockAccount.contacts[contactIndex].seniority,
      };
    }
    
    setAssignContact(null);
    setAssignDepartment("");
    setAssignJobTitle("");
    setAssignSeniority("");
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
                <TableHead className="font-semibold">Data Quality</TableHead>
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
              {filteredContacts.map((contact) => {
                const isReady = isContactReady(contact);
                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={(e) => handleRowClick(contact, e)}
                  >
                    <TableCell data-quality-action>
                      {isReady ? (
                        <div className="flex items-center gap-1.5 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Ready</span>
                        </div>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 text-yellow-500 hover:text-yellow-400 transition-colors">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs underline underline-offset-2">Assign</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-4" align="start">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-sm mb-1">Complete Contact Data</h4>
                                <p className="text-xs text-muted-foreground">
                                  Department and Job Title are required to map this contact to the organisation chart.
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Department *</Label>
                                  <Select 
                                    value={assignContact?.id === contact.id ? assignDepartment : (contact.department || "")}
                                    onValueChange={(value) => {
                                      if (assignContact?.id !== contact.id) {
                                        setAssignContact(contact);
                                        setAssignDepartment(value);
                                        setAssignJobTitle(contact.title || "");
                                        setAssignSeniority(contact.seniority || "");
                                      } else {
                                        setAssignDepartment(value);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {departmentOptions.map((dept) => (
                                        <SelectItem key={dept} value={dept} className="text-xs">
                                          {dept}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Job Title *</Label>
                                  <Select 
                                    value={assignContact?.id === contact.id ? assignJobTitle : (contact.title || "")}
                                    onValueChange={(value) => {
                                      if (assignContact?.id !== contact.id) {
                                        setAssignContact(contact);
                                        setAssignDepartment(contact.department || "");
                                        setAssignJobTitle(value);
                                        setAssignSeniority(contact.seniority || "");
                                      } else {
                                        setAssignJobTitle(value);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select job title" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {jobTitleOptions.map((title) => (
                                        <SelectItem key={title} value={title} className="text-xs">
                                          {title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Seniority (optional)</Label>
                                  <Select 
                                    value={assignContact?.id === contact.id ? assignSeniority : (contact.seniority || "")}
                                    onValueChange={(value) => {
                                      if (assignContact?.id !== contact.id) {
                                        setAssignContact(contact);
                                        setAssignDepartment(contact.department || "");
                                        setAssignJobTitle(contact.title || "");
                                        setAssignSeniority(value);
                                      } else {
                                        setAssignSeniority(value);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select seniority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {seniorityOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                className="w-full"
                                disabled={
                                  !(assignContact?.id === contact.id ? assignDepartment : contact.department) ||
                                  !(assignContact?.id === contact.id ? assignJobTitle : contact.title)
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (assignContact?.id !== contact.id) {
                                    setAssignContact(contact);
                                  }
                                  handleSaveAssignment();
                                }}
                              >
                                Save & Mark Ready
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{companyName}</TableCell>
                    <TableCell>{contact.department || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell>{contact.title || <span className="text-muted-foreground italic">—</span>}</TableCell>
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
                );
              })}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
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
