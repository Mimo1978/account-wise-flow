import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { mockAccount } from "@/lib/mock-data";
import { Contact, PhoneNumber } from "@/lib/types";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { PhoneInlineEditor } from "@/components/canvas/PhoneInlineEditor";
import { PrivateEmailEditor } from "@/components/canvas/PrivateEmailEditor";
import { InlineEditCell } from "@/components/canvas/InlineEditCell";
import { AddContactModal } from "@/components/canvas/AddContactModal";
import { SmartImportModal } from "@/components/import/SmartImportModal";
import { ImportCenterModal } from "@/components/import/ImportCenterModal";
import { ImportMethod } from "@/components/import/ImportCenterTypes";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { ContactRecordPanel } from "@/components/contact/ContactRecordPanel";
import { CompanyOverviewPanel } from "@/components/company/CompanyOverviewPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import {
  Search,
  Plus,
  Upload,
  Network,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  FileText,
  ClipboardPaste,
  ChevronDown,
  ExternalLink,
  ScanLine,
} from "lucide-react";
import {
  departmentOptions,
  jobTitleOptions,
  seniorityOptions,
} from "@/lib/dropdown-options";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Helper to check data quality
const isContactReady = (contact: Contact): boolean => {
  return Boolean(contact.department && contact.department.trim() !== "" && contact.title && contact.title.trim() !== "");
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

export default function ContactsDatabase() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactRecordOpen, setContactRecordOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  // Permissions
  const { role, canInsert, canEdit, isLoading: permissionsLoading } = usePermissions();
  const insertTooltip = getPermissionTooltip("insert", role);
  const editTooltip = getPermissionTooltip("edit", role);
  
  // Mock current user ID (in real app, get from auth)
  const currentUserId = "user-1"; // Sarah Williams

  // Check if this is the first visit to show scroll hint
  useEffect(() => {
    const visitedKey = "contacts-database-visited";
    if (!sessionStorage.getItem(visitedKey)) {
      setIsFirstVisit(true);
      sessionStorage.setItem(visitedKey, "true");
    }
  }, []);

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

      // "Assigned to me" filter - checks if user is owner or team member
      // In real app, this would check owner_id and contact_team_members table
      const matchesAssigned =
        assignedFilter === "all" || 
        (assignedFilter === "assigned-to-me" && contact.contactOwner === "Sarah Williams");

      return matchesSearch && matchesDepartment && matchesStatus && matchesOwner && matchesAssigned;
    });
  }, [allContacts, searchQuery, departmentFilter, statusFilter, ownerFilter, assignedFilter, companyName]);

  // Single click = select row
  const handleRowClick = (contact: Contact, e: React.MouseEvent) => {
    // Don't select if clicking on data quality actions or name link
    if ((e.target as HTMLElement).closest('[data-quality-action]') ||
        (e.target as HTMLElement).closest('[data-contact-name]') ||
        (e.target as HTMLElement).closest('[data-open-icon]')) {
      return;
    }
    setSelectedRowId(contact.id === selectedRowId ? null : contact.id);
  };

  // Double click = open Contact Record
  const handleRowDoubleClick = (contact: Contact, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-quality-action]')) {
      return;
    }
    openContactRecord(contact);
  };

  // Click on name = open Contact Record
  const handleNameClick = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    openContactRecord(contact);
  };

  // Open Contact Record panel
  const openContactRecord = (contact: Contact) => {
    setSelectedContact(contact);
    setContactRecordOpen(true);
  };

  // Open Company panel from Contact Record
  const handleOpenCompany = () => {
    setCompanyPanelOpen(true);
  };

  const handleViewOrgChart = () => {
    navigate("/canvas");
  };

  // State for assign modal
  const [assignContact, setAssignContact] = useState<Contact | null>(null);
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assignJobTitle, setAssignJobTitle] = useState("");
  const [assignSeniority, setAssignSeniority] = useState("");
  
  // State for custom "Other" inputs
  const [customDepartment, setCustomDepartment] = useState("");
  const [customJobTitle, setCustomJobTitle] = useState("");
  const [showCustomDept, setShowCustomDept] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);

  // State for Add Contact and Import modals
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showAIImportModal, setShowAIImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportMethod, setBulkImportMethod] = useState<ImportMethod>("file");

  const handleAddContact = (contact: Contact) => {
    mockAccount.contacts.push(contact);
    toast.success(`${contact.name} added to database`);
  };

  const handleOpenAssign = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignContact(contact);
    setAssignDepartment(contact.department || "");
    setAssignJobTitle(contact.title || "");
    setAssignSeniority(contact.seniority || "");
    setShowCustomDept(false);
    setShowCustomTitle(false);
    setCustomDepartment("");
    setCustomJobTitle("");
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

  const getFinalDepartment = () => showCustomDept ? customDepartment : assignDepartment;
  const getFinalJobTitle = () => showCustomTitle ? customJobTitle : assignJobTitle;

  const handleSaveAssignment = () => {
    if (!assignContact) return;
    
    const finalDept = getFinalDepartment();
    const finalTitle = getFinalJobTitle();
    
    // Validate required fields
    if (!finalDept || !finalTitle) {
      return; // Don't save if missing required fields
    }

    // Update the contact in mock data (in real app, this would be an API call)
    const contactIndex = mockAccount.contacts.findIndex(c => c.id === assignContact.id);
    if (contactIndex !== -1) {
      mockAccount.contacts[contactIndex] = {
        ...mockAccount.contacts[contactIndex],
        department: finalDept,
        title: finalTitle,
        seniority: assignSeniority as Contact["seniority"] || mockAccount.contacts[contactIndex].seniority,
      };
    }
    
    setAssignContact(null);
    setAssignDepartment("");
    setAssignJobTitle("");
    setAssignSeniority("");
    setShowCustomDept(false);
    setShowCustomTitle(false);
    setCustomDepartment("");
    setCustomJobTitle("");
  };

  return (
    <div className="bg-background">
      {/* Page Sub-header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Contacts Database
              </h1>
              <p className="text-sm text-muted-foreground">
                {companyName} • {filteredContacts.length} contacts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddContactModal(true)}
                      disabled={!canInsert}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </span>
                </TooltipTrigger>
                {insertTooltip && (
                  <TooltipContent side="bottom">
                    <p className="text-sm">{insertTooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" disabled={!canInsert}>
                          <Upload className="h-4 w-4" />
                          Import
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => {
                          setBulkImportMethod("file");
                          setShowBulkImportModal(true);
                        }}>
                          <FileText className="h-4 w-4 mr-2" />
                          Import from CSV / XLSX
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setBulkImportMethod("ocr");
                          setShowBulkImportModal(true);
                        }}>
                          <ScanLine className="h-4 w-4 mr-2" />
                          Scan Image / PDF (OCR)
                          <Badge variant="outline" className="ml-auto text-xs">Beta</Badge>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIImportModal(true)}>
                          <FileImage className="h-4 w-4 mr-2" />
                          Import from Image
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIImportModal(true)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Import from Document
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIImportModal(true)}>
                          <Network className="h-4 w-4 mr-2" />
                          Import from Org Chart
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAIImportModal(true)}>
                          <ClipboardPaste className="h-4 w-4 mr-2" />
                          Import from Clipboard / Screenshot
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </TooltipTrigger>
                {insertTooltip && (
                  <TooltipContent side="bottom">
                    <p className="text-sm">{insertTooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
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
          <Select value={assignedFilter} onValueChange={setAssignedFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="assigned-to-me">Assigned to Me</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden relative">
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 280px)"
            leftPinnedWidth={280}
          >
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead 
                    className="font-semibold whitespace-nowrap bg-muted"
                    style={{ 
                      position: "sticky", 
                      left: 0, 
                      zIndex: 30,
                      minWidth: 100,
                    }}
                  >
                    Data Quality
                  </TableHead>
                  <TableHead 
                    className="font-semibold whitespace-nowrap bg-muted"
                    style={{ 
                      position: "sticky", 
                      left: 100, 
                      zIndex: 30,
                      minWidth: 180,
                      boxShadow: "4px 0 8px -4px hsl(var(--foreground) / 0.12)",
                    }}
                  >
                    Name
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Company</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Department</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Job Title</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Seniority</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Email</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Private Email</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Phone</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Status</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Owner</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => {
                const isReady = isContactReady(contact);
                return (
                  <TableRow
                    key={contact.id}
                    className={cn(
                      "cursor-pointer transition-colors group",
                      selectedRowId === contact.id 
                        ? "bg-primary/10 hover:bg-primary/15" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={(e) => handleRowClick(contact, e)}
                    onDoubleClick={(e) => handleRowDoubleClick(contact, e)}
                  >
                    <TableCell 
                      data-quality-action
                      className="bg-card"
                      style={{ 
                        position: "sticky", 
                        left: 0, 
                        zIndex: 20,
                        minWidth: 100,
                      }}
                    >
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
                                  {showCustomDept && assignContact?.id === contact.id ? (
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="Enter custom department"
                                      value={customDepartment}
                                      onChange={(e) => setCustomDepartment(e.target.value)}
                                      autoFocus
                                    />
                                  ) : (
                                    <Select 
                                      value={assignContact?.id === contact.id ? assignDepartment : (contact.department || "")}
                                      onValueChange={(value) => handleDepartmentChange(value, contact)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select department" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[300px]">
                                        {departmentOptions.map((dept) => (
                                          <SelectItem key={dept} value={dept} className="text-xs">
                                            {dept}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value={OTHER_CUSTOM} className="text-xs text-muted-foreground italic">
                                          Other (custom)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">Job Title *</Label>
                                  {showCustomTitle && assignContact?.id === contact.id ? (
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="Enter custom job title"
                                      value={customJobTitle}
                                      onChange={(e) => setCustomJobTitle(e.target.value)}
                                      autoFocus
                                    />
                                  ) : (
                                    <Select 
                                      value={assignContact?.id === contact.id ? assignJobTitle : (contact.title || "")}
                                      onValueChange={(value) => handleJobTitleChange(value, contact)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select job title" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[300px]">
                                        {Object.entries(jobTitleOptions).map(([group, titles]) => (
                                          <SelectGroup key={group}>
                                            <SelectLabel className="text-xs font-semibold text-muted-foreground">{group}</SelectLabel>
                                            {titles.map((title) => (
                                              <SelectItem key={title} value={title} className="text-xs">
                                                {title}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        ))}
                                        <SelectItem value={OTHER_CUSTOM} className="text-xs text-muted-foreground italic">
                                          Other (custom)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
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
                                  !(assignContact?.id === contact.id ? getFinalDepartment() : contact.department) ||
                                  !(assignContact?.id === contact.id ? getFinalJobTitle() : contact.title)
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
                    <TableCell 
                      className="font-medium bg-card"
                      style={{ 
                        position: "sticky", 
                        left: 100, 
                        zIndex: 20,
                        minWidth: 180,
                        boxShadow: "4px 0 8px -4px hsl(var(--foreground) / 0.12)",
                      }}
                    >
                      <div className="flex items-center gap-2 group/name">
                        <button
                          data-contact-name
                          onClick={(e) => handleNameClick(contact, e)}
                          className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors text-left truncate"
                        >
                          {contact.name}
                        </button>
                        <button
                          data-open-icon
                          onClick={(e) => handleNameClick(contact, e)}
                          className="opacity-0 group-hover/name:opacity-100 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all flex-shrink-0"
                          title="Open contact record"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="bg-card" style={{ zIndex: 1 }}>{companyName}</TableCell>
                    <TableCell className="bg-card" style={{ zIndex: 1 }}>{contact.department || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="bg-card" style={{ zIndex: 1 }}>{contact.title || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="bg-card" style={{ zIndex: 1 }}>
                      <span className="text-muted-foreground">
                        {seniorityLabels[contact.seniority] || contact.seniority}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground bg-card" style={{ zIndex: 1 }}>
                      {contact.email}
                    </TableCell>
                    <TableCell data-quality-action className="bg-card" style={{ zIndex: 1 }}>
                      <PrivateEmailEditor
                        privateEmail={contact.privateEmail}
                        onSave={(email) => {
                          const contactIndex = mockAccount.contacts.findIndex(c => c.id === contact.id);
                          if (contactIndex !== -1) {
                            mockAccount.contacts[contactIndex] = {
                              ...mockAccount.contacts[contactIndex],
                              privateEmail: email,
                            };
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell data-quality-action className="bg-card" style={{ zIndex: 1 }}>
                      <PhoneInlineEditor
                        phoneNumbers={contact.phoneNumbers || []}
                        legacyPhone={contact.phone}
                        onSave={(phones: PhoneNumber[]) => {
                          // Update contact in mock data
                          const contactIndex = mockAccount.contacts.findIndex(c => c.id === contact.id);
                          if (contactIndex !== -1) {
                            mockAccount.contacts[contactIndex] = {
                              ...mockAccount.contacts[contactIndex],
                              phoneNumbers: phones,
                              phone: phones.find(p => p.preferred)?.value || phones[0]?.value || "",
                            };
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell data-quality-action className="bg-card" style={{ zIndex: 1 }}>
                      <InlineEditCell
                        value={contact.status}
                        displayValue={
                          <Badge
                            variant="secondary"
                            className={statusColors[contact.status]}
                          >
                            {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                          </Badge>
                        }
                        onSave={(value) => {
                          const contactIndex = mockAccount.contacts.findIndex(c => c.id === contact.id);
                          if (contactIndex !== -1) {
                            mockAccount.contacts[contactIndex] = {
                              ...mockAccount.contacts[contactIndex],
                              status: value as Contact["status"],
                            };
                          }
                        }}
                        type="select"
                        options={statusOptions}
                        placeholder="Select status"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground bg-card" style={{ zIndex: 1 }}>
                      {contact.contactOwner || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground bg-card" style={{ zIndex: 1 }}>
                      {contact.lastContact || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No contacts found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </ScrollableTableContainer>
        </div>
      </div>

      {/* Contact Record Panel */}
      <ContactRecordPanel
        contact={selectedContact}
        companyName={companyName}
        company={mockAccount}
        open={contactRecordOpen}
        onOpenChange={(open) => {
          setContactRecordOpen(open);
          if (!open) setSelectedContact(null);
        }}
        onOpenCompany={handleOpenCompany}
      />

      {/* Company Overview Panel */}
      <CompanyOverviewPanel
        company={mockAccount}
        open={companyPanelOpen}
        onClose={() => setCompanyPanelOpen(false)}
        onOpenCanvas={() => navigate("/canvas")}
        onViewContacts={() => setCompanyPanelOpen(false)}
      />

      {/* Add Contact Modal */}
      <AddContactModal
        open={showAddContactModal}
        onOpenChange={setShowAddContactModal}
        onAddContact={handleAddContact}
        companyName={companyName}
      />

      {/* Smart Import Modal (AI-based import for images, docs, etc.) */}
      <SmartImportModal
        open={showAIImportModal}
        onOpenChange={setShowAIImportModal}
        context={{
          source: 'CONTACT',
          companyName: companyName,
        }}
      />

      {/* Bulk CSV/XLSX/OCR Import Modal - Shared Component */}
      <ImportCenterModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        entityType="contacts"
        initialMethod={bulkImportMethod}
        onImportComplete={(records) => {
          // Add imported contacts to the list
          records.forEach((record) => {
            const newContact: Contact = {
              id: record.id,
              name: record.name || "Unknown",
              email: record.email || "",
              phone: record.phone || "",
              phoneNumbers: record.phone ? [{ value: record.phone, label: "Mobile", preferred: true }] : [],
              privateEmail: record.email || "",
              department: record.department || "",
              title: record.title || "",
              seniority: record.seniority || "mid",
              status: record.status || "new",
              linkedIn: "",
              notes: record.notes || "",
            };
            mockAccount.contacts.push(newContact);
          });
        }}
      />
    </div>
  );
}
