import { useState, useMemo } from "react";
import { Account, Contact, PhoneNumber } from "@/lib/types";
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
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Network,
  Mail,
} from "lucide-react";
import {
  departmentOptions,
  jobTitleOptions,
  seniorityOptions,
} from "@/lib/dropdown-options";
import { toast } from "sonner";
import { PhoneInlineEditor } from "./PhoneInlineEditor";

interface CompanyDatabaseViewProps {
  account: Account;
  onAccountUpdate: (account: Account) => void;
  onViewCanvas: () => void;
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
  onAccountUpdate,
  onViewCanvas,
}: CompanyDatabaseViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const allContacts = account.contacts;

  const departments = useMemo(() => {
    const depts = new Set(allContacts.map((c) => c.department));
    return Array.from(depts).sort();
  }, [allContacts]);

  const statuses = ["unknown", "new", "warm", "engaged", "champion", "blocker"];

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let result = allContacts.filter((contact) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchLower) ||
        contact.department.toLowerCase().includes(searchLower) ||
        contact.title.toLowerCase().includes(searchLower) ||
        (contact.email?.toLowerCase().includes(searchLower) ?? false);

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
    allContacts,
    searchQuery,
    departmentFilter,
    statusFilter,
    sortField,
    sortDirection,
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
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    filteredContacts.length > 0 &&
                    selectedIds.size === filteredContacts.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="font-semibold w-[100px]">
                Data Quality
              </TableHead>
              <SortableHeader field="name">Name</SortableHeader>
              <SortableHeader field="department">Department</SortableHeader>
              <SortableHeader field="title">Job Title</SortableHeader>
              <TableHead className="font-semibold">Seniority</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Private Email</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="lastContact">Last Contacted</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact) => {
              const isReady = isContactReady(contact);
              return (
                <TableRow
                  key={contact.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(contact.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(contact.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
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
                            <span className="text-xs underline underline-offset-2">
                              Assign
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4" align="start">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-1">
                                Complete Contact Data
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Department and Job Title are required.
                              </p>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Department *</Label>
                                {showCustomDept &&
                                assignContact?.id === contact.id ? (
                                  <Input
                                    className="h-8 text-xs"
                                    placeholder="Enter custom department"
                                    value={customDepartment}
                                    onChange={(e) =>
                                      setCustomDepartment(e.target.value)
                                    }
                                    autoFocus
                                  />
                                ) : (
                                  <Select
                                    value={
                                      assignContact?.id === contact.id
                                        ? assignDepartment
                                        : contact.department || ""
                                    }
                                    onValueChange={(value) =>
                                      handleDepartmentChange(value, contact)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                      {departmentOptions.map((dept) => (
                                        <SelectItem
                                          key={dept}
                                          value={dept}
                                          className="text-xs"
                                        >
                                          {dept}
                                        </SelectItem>
                                      ))}
                                      <SelectItem
                                        value={OTHER_CUSTOM}
                                        className="text-xs text-muted-foreground italic"
                                      >
                                        Other (custom)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Job Title *</Label>
                                {showCustomTitle &&
                                assignContact?.id === contact.id ? (
                                  <Input
                                    className="h-8 text-xs"
                                    placeholder="Enter custom job title"
                                    value={customJobTitle}
                                    onChange={(e) =>
                                      setCustomJobTitle(e.target.value)
                                    }
                                    autoFocus
                                  />
                                ) : (
                                  <Select
                                    value={
                                      assignContact?.id === contact.id
                                        ? assignJobTitle
                                        : contact.title || ""
                                    }
                                    onValueChange={(value) =>
                                      handleJobTitleChange(value, contact)
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select job title" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                      {Object.entries(jobTitleOptions).map(
                                        ([group, titles]) => (
                                          <SelectGroup key={group}>
                                            <SelectLabel className="text-xs font-semibold text-muted-foreground">
                                              {group}
                                            </SelectLabel>
                                            {titles.map((title) => (
                                              <SelectItem
                                                key={title}
                                                value={title}
                                                className="text-xs"
                                              >
                                                {title}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        )
                                      )}
                                      <SelectItem
                                        value={OTHER_CUSTOM}
                                        className="text-xs text-muted-foreground italic"
                                      >
                                        Other (custom)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Seniority</Label>
                                <Select
                                  value={
                                    assignContact?.id === contact.id
                                      ? assignSeniority
                                      : contact.seniority || ""
                                  }
                                  onValueChange={(value) => {
                                    if (assignContact?.id !== contact.id) {
                                      setAssignContact(contact);
                                      setAssignDepartment(
                                        contact.department || ""
                                      );
                                      setAssignJobTitle(contact.title || "");
                                    }
                                    setAssignSeniority(value);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select seniority" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {seniorityOptions.map((s) => (
                                      <SelectItem
                                        key={s.value}
                                        value={s.value}
                                        className="text-xs"
                                      >
                                        {s.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleSaveAssignment(contact.id)}
                              disabled={
                                assignContact?.id !== contact.id ||
                                !getFinalDepartment() ||
                                !getFinalJobTitle()
                              }
                            >
                              Save
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.department}</TableCell>
                  <TableCell>{contact.title}</TableCell>
                  <TableCell>
                    {contact.seniority
                      ? seniorityLabels[contact.seniority] || contact.seniority
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email || "-"}
                  </TableCell>
                  <TableCell>
                    {contact.privateEmail ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground/70">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[140px]">{contact.privateEmail}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PhoneInlineEditor
                      phoneNumbers={contact.phoneNumbers || []}
                      legacyPhone={contact.phone}
                      onSave={(phones: PhoneNumber[]) => {
                        updateContact(contact.id, {
                          phoneNumbers: phones,
                          phone: phones.find(p => p.preferred)?.value || phones[0]?.value || "",
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[contact.status] || ""}>
                      {contact.status.charAt(0).toUpperCase() +
                        contact.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.lastContact || "-"}
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
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredContacts.length} of {allContacts.length} contacts
          </span>
          <span>
            {filteredContacts.filter(isContactReady).length} ready for canvas
          </span>
        </div>
      </div>
    </div>
  );
};
