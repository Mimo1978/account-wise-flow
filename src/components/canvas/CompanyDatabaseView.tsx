import { useState, useMemo } from "react";
import { Account, Contact, PhoneNumber, RelationshipStatus, DataQuality } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Network,
  ExternalLink,
  UserPlus,
  Upload,
  FileImage,
  FileText,
  ClipboardPaste,
  ChevronDown,
  Building2,
  Globe,
  MapPin,
  Phone,
  Shield,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  departmentOptions,
  jobTitleOptions,
  seniorityOptions,
} from "@/lib/dropdown-options";
import { toast } from "sonner";
import { PhoneInlineEditor } from "./PhoneInlineEditor";
import { PrivateEmailEditor } from "./PrivateEmailEditor";
import { InlineEditCell } from "./InlineEditCell";
import { GlobalScopedSearch, SearchScope } from "./GlobalScopedSearch";
import { TableViewControls, TableDensity, TableColumnConfig } from "./TableViewControls";
import { ScrollableTableContainer } from "./ScrollableTableContainer";
import { mockTalents } from "@/lib/mock-talent";
import { Talent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// Company-level status configuration
const getRelationshipStatusConfig = (status?: RelationshipStatus) => {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-accent text-accent-foreground" };
    case "warm":
      return { label: "Warm", className: "bg-primary/10 text-primary" };
    case "cooling":
      return { label: "Cooling", className: "bg-secondary text-secondary-foreground" };
    case "dormant":
      return { label: "Dormant", className: "bg-muted text-muted-foreground" };
    default:
      return { label: "—", className: "bg-muted text-muted-foreground" };
  }
};

const getDataQualityConfig = (quality?: DataQuality) => {
  switch (quality) {
    case "complete":
      return { label: "Complete", icon: CheckCircle2, className: "text-accent-foreground" };
    case "partial":
      return { label: "Partial", icon: AlertCircle, className: "text-secondary-foreground" };
    case "minimal":
      return { label: "Minimal", icon: AlertCircle, className: "text-muted-foreground" };
    default:
      return { label: "—", icon: null, className: "text-muted-foreground" };
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    if (dateString.includes("day") || dateString.includes("hour")) {
      return dateString;
    }
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
};

interface CompanyDatabaseViewProps {
  account: Account;
  allAccounts?: Account[];
  onAccountUpdate: (account: Account) => void;
  onViewCanvas: () => void;
  onContactSelect?: (contact: Contact) => void;
  onAddContact?: () => void;
  onAIImport?: () => void;
  onSelectTalent?: (talent: Talent) => void;
}

const isContactReady = (contact: Contact): boolean => {
  return Boolean(
    contact.department &&
      contact.department.trim() !== "" &&
      contact.title &&
      contact.title.trim() !== ""
  );
};

const OTHER_CUSTOM = "__other_custom__";

const statusColors: Record<string, string> = {
  unknown: "bg-muted text-muted-foreground",
  new: "bg-blue-500/20 text-blue-400",
  warm: "bg-yellow-500/20 text-yellow-400",
  engaged: "bg-green-500/20 text-green-400",
  champion: "bg-purple-500/20 text-purple-400",
  blocker: "bg-red-500/20 text-red-400",
};

const statusOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "new", label: "New" },
  { value: "warm", label: "Warm" },
  { value: "engaged", label: "Engaged" },
  { value: "champion", label: "Champion" },
  { value: "blocker", label: "Blocker" },
];

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

type SortField = "name" | "department" | "title" | "status" | "lastContact";
type SortDirection = "asc" | "desc";

export const CompanyDatabaseView = ({
  account,
  allAccounts = [],
  onAccountUpdate,
  onViewCanvas,
  onContactSelect,
  onAddContact,
  onAIImport,
  onSelectTalent,
}: CompanyDatabaseViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchScope, setSearchScope] = useState<"this" | "all">("this");
  
  // View controls state
  const [tableDensity, setTableDensity] = useState<TableDensity>("comfortable");
  const [columnConfig, setColumnConfig] = useState<TableColumnConfig[]>([
    { id: "dataQuality", label: "Data Quality", visible: true, category: "Core" },
    { id: "company", label: "Company", visible: true, category: "Core" },
    { id: "name", label: "Name", visible: true, sticky: true, category: "Core" },
    { id: "department", label: "Department", visible: true, category: "Core" },
    { id: "title", label: "Job Title", visible: true, category: "Core" },
    { id: "seniority", label: "Seniority", visible: true, category: "Core" },
    { id: "email", label: "Email", visible: true, category: "Contact" },
    { id: "privateEmail", label: "Private Email", visible: true, category: "Contact" },
    { id: "phone", label: "Phone", visible: true, category: "Contact" },
    { id: "status", label: "Status", visible: true, sticky: true, category: "Status" },
    { id: "lastContact", label: "Last Contacted", visible: true, category: "Operational" },
  ]);
  
  // Track edited contacts (staged changes)
  const [editedContacts, setEditedContacts] = useState<Set<string>>(new Set());

  // Assign modal state
  const [assignContact, setAssignContact] = useState<Contact | null>(null);
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignJobTitle, setAssignJobTitle] = useState("");
  const [assignSeniority, setAssignSeniority] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [showCustomDept, setShowCustomDept] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);

  // Bulk edit state
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkJobTitle, setBulkJobTitle] = useState("");
  
  // Column visibility helpers
  const isColumnVisible = (columnId: string) => {
    const col = columnConfig.find(c => c.id === columnId);
    return col?.visible ?? true;
  };

  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    setColumnConfig(prev => 
      prev.map(col => col.id === columnId ? { ...col, visible } : col)
    );
  };

  const handleResetColumns = () => {
    setColumnConfig(prev => prev.map(col => ({ ...col, visible: true })));
  };

  // Density class helper
  const densityClasses = tableDensity === "compact" 
    ? "text-xs [&_td]:py-1.5 [&_th]:py-1.5" 
    : "text-sm [&_td]:py-3 [&_th]:py-3";

  // Build contact list with company info for "All Companies" mode
  const contactsWithCompany = useMemo(() => {
    if (searchScope === "this") {
      return account.contacts.map((c) => ({ ...c, companyName: account.name, companyId: account.id }));
    }
    // All companies mode
    return allAccounts.flatMap((acc) =>
      acc.contacts.map((c) => ({ ...c, companyName: acc.name, companyId: acc.id }))
    );
  }, [searchScope, account, allAccounts]);

  const allContacts = searchScope === "this" ? account.contacts : contactsWithCompany;

  const departments = useMemo(() => {
    const depts = new Set(contactsWithCompany.map((c) => c.department));
    return Array.from(depts).sort();
  }, [contactsWithCompany]);

  const statuses = ["unknown", "new", "warm", "engaged", "champion", "blocker"];

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let result = contactsWithCompany.filter((contact) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchLower) ||
        contact.department.toLowerCase().includes(searchLower) ||
        contact.title.toLowerCase().includes(searchLower) ||
        (contact.email?.toLowerCase().includes(searchLower) ?? false) ||
        (searchScope === "all" && contact.companyName?.toLowerCase().includes(searchLower));

      const matchesDepartment =
        departmentFilter === "all" || contact.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      let aVal: string | undefined;
      let bVal: string | undefined;

      switch (sortField) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "department":
          aVal = a.department;
          bVal = b.department;
          break;
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "lastContact":
          aVal = a.lastContact;
          bVal = b.lastContact;
          break;
      }

      const comparison = (aVal || "").localeCompare(bVal || "");
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    contactsWithCompany,
    searchQuery,
    departmentFilter,
    statusFilter,
    sortField,
    sortDirection,
    searchScope,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const updateContact = (contactId: string, updates: Partial<Contact>) => {
    const updatedContacts = account.contacts.map((c) =>
      c.id === contactId ? { ...c, ...updates } : c
    );
    onAccountUpdate({ ...account, contacts: updatedContacts });
    
    // Mark as edited briefly for visual feedback
    setEditedContacts((prev) => new Set(prev).add(contactId));
    setTimeout(() => {
      setEditedContacts((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }, 1500);
    
    toast.success("Contact updated");
  };

  const handleDepartmentChange = (value: string, contact: Contact) => {
    if (assignContact?.id !== contact.id) {
      setAssignContact(contact);
      setAssignJobTitle(contact.title || "");
      setAssignSeniority(contact.seniority || "");
    }
    if (value === OTHER_CUSTOM) {
      setShowCustomDept(true);
      setAssignDepartment("");
    } else {
      setShowCustomDept(false);
      setCustomDepartment("");
      setAssignDepartment(value);
    }
  };

  const handleJobTitleChange = (value: string, contact: Contact) => {
    if (assignContact?.id !== contact.id) {
      setAssignContact(contact);
      setAssignDepartment(contact.department || "");
      setAssignSeniority(contact.seniority || "");
    }
    if (value === OTHER_CUSTOM) {
      setShowCustomTitle(true);
      setAssignJobTitle("");
    } else {
      setShowCustomTitle(false);
      setCustomJobTitle("");
      setAssignJobTitle(value);
    }
  };

  const getFinalDepartment = () =>
    showCustomDept ? customDepartment : assignDepartment;
  const getFinalJobTitle = () =>
    showCustomTitle ? customJobTitle : assignJobTitle;

  const handleSaveAssignment = (contactId: string) => {
    const finalDept = getFinalDepartment();
    const finalTitle = getFinalJobTitle();

    if (!finalDept || !finalTitle) {
      return;
    }

    updateContact(contactId, {
      department: finalDept,
      title: finalTitle,
      seniority: assignSeniority as Contact["seniority"] || undefined,
    });

    toast.success("Contact updated");
    resetAssignState();
  };

  const resetAssignState = () => {
    setAssignContact(null);
    setAssignDepartment("");
    setAssignJobTitle("");
    setAssignSeniority("");
    setShowCustomDept(false);
    setShowCustomTitle(false);
    setCustomDepartment("");
    setCustomJobTitle("");
  };

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0) return;

    const updates: Partial<Contact> = {};
    if (bulkDepartment && bulkDepartment !== "no_change") {
      updates.department = bulkDepartment;
    }
    if (bulkJobTitle && bulkJobTitle !== "no_change") {
      updates.title = bulkJobTitle;
    }

    if (Object.keys(updates).length === 0) {
      toast.error("Please select at least one field to update");
      return;
    }

    const updatedContacts = account.contacts.map((c) =>
      selectedIds.has(c.id) ? { ...c, ...updates } : c
    );
    onAccountUpdate({ ...account, contacts: updatedContacts });
    toast.success(`Updated ${selectedIds.size} contacts`);
    setSelectedIds(new Set());
    setBulkDepartment("");
    setBulkJobTitle("");
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="font-semibold cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            onClick={onAddContact} 
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add Contact
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={onAIImport}>
                <FileText className="h-4 w-4 mr-2" />
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAIImport}>
                <FileImage className="h-4 w-4 mr-2" />
                Import from Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAIImport}>
                <FileText className="h-4 w-4 mr-2" />
                Import from Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAIImport}>
                <Network className="h-4 w-4 mr-2" />
                Import from Org Chart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAIImport}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Import from Clipboard / Screenshot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Global Scoped Search */}
          <GlobalScopedSearch
            currentAccount={account}
            allAccounts={allAccounts}
            externalQuery={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectContact={(contact, companyId) => {
              onContactSelect?.(contact);
            }}
            onSelectCompany={(company) => {
              // Could trigger navigation or account switch
            }}
            onSelectTalent={(talent) => {
              onSelectTalent?.(talent);
            }}
            className="flex-1 min-w-[400px]"
          />
          
          {/* Scope Toggle for Table View */}
          <div className="flex items-center gap-2">
            <ToggleGroup 
              type="single" 
              value={searchScope} 
              onValueChange={(value) => value && setSearchScope(value as "this" | "all")}
              className="shrink-0"
            >
              <ToggleGroupItem value="this" aria-label="This company" className="gap-1.5 text-xs px-3">
                <Building2 className="h-3.5 w-3.5" />
                This Company
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="All companies" className="gap-1.5 text-xs px-3">
                <Globe className="h-3.5 w-3.5" />
                All Companies
              </ToggleGroupItem>
            </ToggleGroup>
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
          <TableViewControls
            density={tableDensity}
            onDensityChange={setTableDensity}
            columns={columnConfig}
            onColumnVisibilityChange={handleColumnVisibilityChange}
            onResetColumns={handleResetColumns}
          />
          <Button onClick={onViewCanvas} className="gap-2">
            <Network className="h-4 w-4" />
            View on Canvas
          </Button>
        </div>

        {/* Bulk Edit Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Select value={bulkDepartment} onValueChange={setBulkDepartment}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Set Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_change">No change</SelectItem>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bulkJobTitle} onValueChange={setBulkJobTitle}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Set Job Title" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="no_change">No change</SelectItem>
                {Object.entries(jobTitleOptions).map(([group, titles]) => (
                  <SelectGroup key={group}>
                    <SelectLabel className="text-xs font-semibold">
                      {group}
                    </SelectLabel>
                    {titles.map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkUpdate}>
              Apply Changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {/* Companies Table - shown when "All Companies" is selected */}
      {searchScope === "all" ? (
        <CompaniesTableView
          allAccounts={allAccounts}
          densityClasses={densityClasses}
          onViewCanvas={onViewCanvas}
        />
      ) : (
        <>
          {/* Contacts Table - shown when "This Company" is selected */}
          <ScrollableTableContainer className="flex-1">
            <Table className={cn("min-w-[1400px]", densityClasses)}>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px] sticky left-0 bg-muted/50 z-20">
                    <Checkbox
                      checked={
                        filteredContacts.length > 0 &&
                        selectedIds.size === filteredContacts.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  {isColumnVisible("dataQuality") && (
                    <TableHead className="font-semibold w-[100px]">
                      Data Quality
                    </TableHead>
                  )}
                  {isColumnVisible("name") && (
                    <TableHead className="font-semibold min-w-[160px] sticky left-[40px] bg-muted/50 z-20">
                      <div 
                        className="flex items-center gap-1 cursor-pointer" 
                        onClick={() => handleSort("name")}
                      >
                        Name
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                  )}
                  {isColumnVisible("department") && (
                    <SortableHeader field="department">Department</SortableHeader>
                  )}
                  {isColumnVisible("title") && (
                    <SortableHeader field="title">Job Title</SortableHeader>
                  )}
                  {isColumnVisible("seniority") && (
                    <TableHead className="font-semibold">Seniority</TableHead>
                  )}
                  {isColumnVisible("email") && (
                    <TableHead className="font-semibold min-w-[200px]">Email</TableHead>
                  )}
                  {isColumnVisible("privateEmail") && (
                    <TableHead className="font-semibold min-w-[180px]">Private Email</TableHead>
                  )}
                  {isColumnVisible("phone") && (
                    <TableHead className="font-semibold min-w-[200px]">Phone</TableHead>
                  )}
                  {isColumnVisible("status") && (
                    <TableHead className="font-semibold min-w-[100px] sticky right-[50px] bg-muted/50 z-20">
                      <div 
                        className="flex items-center gap-1 cursor-pointer" 
                        onClick={() => handleSort("status")}
                      >
                        Status
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                  )}
                  {isColumnVisible("lastContact") && (
                    <SortableHeader field="lastContact">Last Contacted</SortableHeader>
                  )}
                  <TableHead className="font-semibold w-[50px] sticky right-0 bg-muted/50 z-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => {
                  const isReady = isContactReady(contact);
                  return (
                    <TableRow
                      key={contact.id}
                      className="hover:bg-muted/50 transition-colors group"
                    >
                      <TableCell className="sticky left-0 bg-background z-10">
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(contact.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      {isColumnVisible("dataQuality") && (
                        <TableCell>
                          {isReady ? (
                            <div className="flex items-center gap-1.5 text-accent-foreground">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Ready</span>
                            </div>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-1.5 text-secondary-foreground hover:text-secondary-foreground/80 transition-colors">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-xs underline underline-offset-2">
                                    Assign
                                  </span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="start">
                                <div className="space-y-4">
                                  <h4 className="font-semibold">
                                    Complete Contact Details
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Assign department and job title to make this
                                    contact appear on the canvas.
                                  </p>
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">
                                        Department
                                      </Label>
                                      <Select
                                        value={
                                          assignContact?.id === contact.id
                                            ? assignDepartment
                                            : contact.department || ""
                                        }
                                        onValueChange={(v) =>
                                          handleDepartmentChange(v, contact)
                                        }
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {departmentOptions.map((dept) => (
                                            <SelectItem key={dept} value={dept}>
                                              {dept}
                                            </SelectItem>
                                          ))}
                                          <SelectItem value={OTHER_CUSTOM}>
                                            Other (custom)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {showCustomDept &&
                                        assignContact?.id === contact.id && (
                                          <Input
                                            placeholder="Enter custom department"
                                            value={customDepartment}
                                            onChange={(e) =>
                                              setCustomDepartment(e.target.value)
                                            }
                                            className="h-8 text-sm"
                                          />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">
                                        Job Title
                                      </Label>
                                      <Select
                                        value={
                                          assignContact?.id === contact.id
                                            ? assignJobTitle
                                            : contact.title || ""
                                        }
                                        onValueChange={(v) =>
                                          handleJobTitleChange(v, contact)
                                        }
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Select job title" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                          {Object.entries(jobTitleOptions).map(
                                            ([group, titles]) => (
                                              <SelectGroup key={group}>
                                                <SelectLabel className="text-xs font-semibold">
                                                  {group}
                                                </SelectLabel>
                                                {titles.map((title) => (
                                                  <SelectItem
                                                    key={title}
                                                    value={title}
                                                  >
                                                    {title}
                                                  </SelectItem>
                                                ))}
                                              </SelectGroup>
                                            )
                                          )}
                                          <SelectItem value={OTHER_CUSTOM}>
                                            Other (custom)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {showCustomTitle &&
                                        assignContact?.id === contact.id && (
                                          <Input
                                            placeholder="Enter custom job title"
                                            value={customJobTitle}
                                            onChange={(e) =>
                                              setCustomJobTitle(e.target.value)
                                            }
                                            className="h-8 text-sm"
                                          />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium">
                                        Seniority
                                      </Label>
                                      <Select
                                        value={
                                          assignContact?.id === contact.id
                                            ? assignSeniority
                                            : contact.seniority || ""
                                        }
                                        onValueChange={(v) => {
                                          if (assignContact?.id !== contact.id) {
                                            setAssignContact(contact);
                                            setAssignDepartment(
                                              contact.department || ""
                                            );
                                            setAssignJobTitle(contact.title || "");
                                          }
                                          setAssignSeniority(v);
                                        }}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Select seniority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {seniorityOptions.map((sen) => (
                                            <SelectItem key={sen.value} value={sen.value}>
                                              {sen.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                      handleSaveAssignment(contact.id)
                                    }
                                  >
                                    Save
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("name") && (
                        <TableCell className="font-medium sticky left-[40px] bg-background z-10">
                          <InlineEditCell
                            value={contact.name}
                            displayValue={contact.name}
                            onSave={(value) => updateContact(contact.id, { name: value })}
                            placeholder="Enter name"
                            isEdited={editedContacts.has(contact.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("department") && (
                        <TableCell>
                          <InlineEditCell
                            value={contact.department}
                            displayValue={contact.department || <span className="text-muted-foreground">—</span>}
                            onSave={(value) => updateContact(contact.id, { department: value })}
                            type="select"
                            options={departmentOptions.map(d => ({ value: d, label: d }))}
                            placeholder="Select department"
                            isEdited={editedContacts.has(contact.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("title") && (
                        <TableCell>
                          <InlineEditCell
                            value={contact.title}
                            displayValue={contact.title || <span className="text-muted-foreground">—</span>}
                            onSave={(value) => updateContact(contact.id, { title: value })}
                            placeholder="Enter job title"
                            isEdited={editedContacts.has(contact.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("seniority") && (
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {seniorityLabels[contact.seniority] || contact.seniority}
                          </Badge>
                        </TableCell>
                      )}
                      {isColumnVisible("email") && (
                        <TableCell className="text-muted-foreground">
                          <InlineEditCell
                            value={contact.email}
                            displayValue={contact.email || <span className="text-muted-foreground">—</span>}
                            onSave={(value) => updateContact(contact.id, { email: value })}
                            placeholder="Enter email"
                            isEdited={editedContacts.has(contact.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("privateEmail") && (
                        <TableCell>
                          <PrivateEmailEditor
                            privateEmail={contact.privateEmail}
                            onSave={(value) => updateContact(contact.id, { privateEmail: value })}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("phone") && (
                        <TableCell>
                          <PhoneInlineEditor
                            phoneNumbers={
                              contact.phoneNumbers || [
                                { value: contact.phone, label: "Work", preferred: true },
                              ]
                            }
                            onSave={(phoneNumbers: PhoneNumber[]) => {
                              const preferred = phoneNumbers.find(p => p.preferred);
                              updateContact(contact.id, {
                                phoneNumbers,
                                phone: preferred?.value || phoneNumbers[0]?.value || "",
                              });
                            }}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("status") && (
                        <TableCell className="sticky right-[50px] bg-background z-10">
                          <InlineEditCell
                            value={contact.status}
                            displayValue={
                              <Badge className={statusColors[contact.status] || ""}>
                                {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                              </Badge>
                            }
                            onSave={(value) => updateContact(contact.id, { status: value as Contact["status"] })}
                            type="select"
                            options={statusOptions}
                            placeholder="Select status"
                            isEdited={editedContacts.has(contact.id)}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("lastContact") && (
                        <TableCell className="text-muted-foreground">
                          {contact.lastContact || "-"}
                        </TableCell>
                      )}
                      <TableCell>
                        {onContactSelect && (
                          <button
                            onClick={() => onContactSelect(contact)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                            title="View details"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredContacts.length === 0 && (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No contacts found
              </div>
            )}
          </ScrollableTableContainer>

          {/* Footer */}
          <div className="border-t border-border p-3 bg-muted/30">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filteredContacts.length} of {account.contacts.length} contacts
              </span>
              <span>
                {filteredContacts.filter(isContactReady).length} ready for canvas
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Separate component for Companies table view
interface CompaniesTableViewProps {
  allAccounts: Account[];
  densityClasses: string;
  onViewCanvas: () => void;
}

const CompaniesTableView = ({ allAccounts, densityClasses, onViewCanvas }: CompaniesTableViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return allAccounts;
    const searchLower = searchQuery.toLowerCase();
    return allAccounts.filter((account) =>
      account.name.toLowerCase().includes(searchLower) ||
      account.industry.toLowerCase().includes(searchLower) ||
      account.headquarters?.toLowerCase().includes(searchLower) ||
      account.accountManager?.name.toLowerCase().includes(searchLower)
    );
  }, [searchQuery, allAccounts]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanyIds(new Set(filteredCompanies.map((c) => c.id)));
    } else {
      setSelectedCompanyIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedCompanyIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedCompanyIds(newSelection);
  };

  const isAllSelected = filteredCompanies.length > 0 && 
    filteredCompanies.every((c) => selectedCompanyIds.has(c.id));

  return (
    <>
      <ScrollableTableContainer className="flex-1">
        <Table className={cn("min-w-[1200px]", densityClasses)}>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Headquarters
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Switchboard
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Industry</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Regions
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                Status
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Account Owner
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Last Activity
                </div>
              </TableHead>
              <TableHead className="font-semibold whitespace-nowrap">
                Data Quality
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.map((account) => {
              const statusConfig = getRelationshipStatusConfig(account.relationshipStatus);
              const qualityConfig = getDataQualityConfig(account.dataQuality);
              
              return (
                <TableRow
                  key={account.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors group",
                    selectedCompanyIds.has(account.id) && "bg-primary/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedCompanyIds.has(account.id)}
                      onCheckedChange={(checked) => 
                        handleSelectRow(account.id, checked as boolean)
                      }
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${account.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="hover:text-primary transition-colors">
                        {account.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {account.headquarters || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground font-mono">
                      {account.switchboard || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {account.industry}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {account.regions && account.regions.length > 0 ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {account.regions[0]}
                          </Badge>
                          {account.regions.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                              +{account.regions.length - 1}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {account.accountManager ? (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
                          {account.accountManager.name.charAt(0)}
                        </div>
                        <span className="text-sm truncate max-w-[120px]">
                          {account.accountManager.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(account.lastInteraction || account.lastUpdated)}
                  </TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-1 text-sm", qualityConfig.className)}>
                      {qualityConfig.icon && <qualityConfig.icon className="h-3.5 w-3.5" />}
                      <span>{qualityConfig.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Could open company detail panel here
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredCompanies.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No companies found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollableTableContainer>

      {/* Footer */}
      <div className="border-t border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredCompanies.length} of {allAccounts.length} companies
          </span>
          {selectedCompanyIds.size > 0 && (
            <span className="text-primary font-medium">
              {selectedCompanyIds.size} selected
            </span>
          )}
        </div>
      </div>
    </>
  );
};
