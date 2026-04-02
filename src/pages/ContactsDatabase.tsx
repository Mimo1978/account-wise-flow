import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceId } from "@/hooks/use-workspace";
import { Contact, PhoneNumber } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { DuplicateDetectionPanel } from "@/components/contact/DuplicateDetectionPanel";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { ContactRecordPanel } from "@/components/contact/ContactRecordPanel";
import { CompanyOverviewPanel } from "@/components/company/CompanyOverviewPanel";
import { AddToOutreachModal } from "@/components/outreach/AddToOutreachModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import { useDeletionPermission, useHardDelete, useRequestDeletion } from "@/hooks/use-deletion";
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
  ArrowLeft,
  Megaphone,
  Trash2,
} from "lucide-react";
import {
  departmentOptions,
  jobTitleOptions,
  seniorityOptions,
} from "@/lib/dropdown-options";
import { toast } from "sonner";
import { RowInlineActions } from "@/components/outreach/RowInlineActions";


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
  const [searchParams] = useSearchParams();
  const companyFilterId = searchParams.get("company") || null;
  const returnTo = searchParams.get("returnTo");
  const returnToCampaignId = searchParams.get("campaignId") ?? undefined;
  const { user } = useAuth();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactRecordOpen, setContactRecordOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddToOutreach, setShowAddToOutreach] = useState(false);
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  // Permissions
  const { role, canInsert, canEdit, isLoading: permissionsLoading } = usePermissions();
  const insertTooltip = getPermissionTooltip("insert", role);
  const editTooltip = getPermissionTooltip("edit", role);
  const perm = useDeletionPermission();
  const softDelete = useHardDelete();
  const requestDeletion = useRequestDeletion();

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch company name when filtering by company
  const { data: filterCompany } = useQuery({
    queryKey: ['company-name', companyFilterId],
    queryFn: async () => {
      if (!companyFilterId) return null;
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyFilterId)
        .single();
      return data;
    },
    enabled: !!companyFilterId,
  });

  // Check if this is the first visit to show scroll hint
  useEffect(() => {
    const visitedKey = "contacts-database-visited";
    if (!sessionStorage.getItem(visitedKey)) {
      setIsFirstVisit(true);
      sessionStorage.setItem(visitedKey, "true");
    }
  }, []);

  // Fetch contacts from the database — scoped to workspace + company if param present
  const { data: dbContacts = [], isLoading } = useQuery({
    queryKey: ['all-contacts', companyFilterId, workspaceId],
    queryFn: async () => {
      // Fetch from core contacts table
      let coreQuery = supabase
        .from('contacts')
        .select('*, companies!contacts_company_id_fkey(name)')
        .order('name');
      
      if (companyFilterId) {
        coreQuery = coreQuery.eq('company_id', companyFilterId);
      }
      if (workspaceId) {
        coreQuery = coreQuery.eq('team_id', workspaceId);
      }
      coreQuery = coreQuery.is('deleted_at', null);

      // Fetch from crm_contacts table
      let crmQuery = supabase
        .from('crm_contacts' as any)
        .select('*, crm_companies(id, name)')
        .is('deleted_at', null)
        .order('last_name');
      
      if (workspaceId) {
        crmQuery = crmQuery.eq('team_id', workspaceId);
      }

      const [{ data: coreContacts, error }, { data: crmContacts }] = await Promise.all([
        coreQuery,
        crmQuery,
      ]);

      if (error) {
        console.error('Error fetching contacts:', error);
        return [];
      }

      if (import.meta.env.DEV) {
        console.debug('[ContactsDatabase] query params:', {
          workspaceId,
          companyFilterId,
          coreCount: coreContacts?.length ?? 0,
          crmCount: (crmContacts as any[])?.length ?? 0,
        });
      }

      // Merge and deduplicate: by email first, then by full name
      const seen = new Set<string>();
      const merged: any[] = [];

      const mapCore = (c: any) => ({
        id: c.id,
        name: c.name,
        title: c.title || '',
        department: c.department || '',
        seniority: (c.seniority as Contact['seniority']) || 'mid',
        email: c.email || '',
        phone: c.phone || '',
        phoneNumbers: c.phone ? [{ value: c.phone, label: 'Work' as const, preferred: true }] : [],
        privateEmail: c.email_private || '',
        status: (c.status as Contact['status']) || 'unknown',
        engagementScore: 50,
        linkedIn: '',
        notes: [] as any,
        contactOwner: '',
        lastContact: '',
        _companyName: c.companies?.name || '',
        _companyId: c.company_id || '',
        _ownerId: c.owner_id || null,
      });

      for (const c of (coreContacts || [])) {
        const emailKey = c.email?.toLowerCase().trim();
        const nameKey = c.name?.toLowerCase().trim();
        const dedupeKey = emailKey || nameKey || c.id;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          if (emailKey && emailKey !== dedupeKey) seen.add(emailKey);
          if (nameKey && nameKey !== dedupeKey) seen.add(nameKey);
          merged.push(mapCore(c));
        }
      }

      for (const c of ((crmContacts as any[]) || [])) {
        const emailKey = c.email?.toLowerCase().trim();
        const nameKey = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().trim();
        const dedupeKey = emailKey || nameKey || c.id;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          if (emailKey && emailKey !== dedupeKey) seen.add(emailKey);
          if (nameKey && nameKey !== dedupeKey) seen.add(nameKey);
          merged.push({
            id: c.id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
            title: c.job_title || '',
            department: '',
            seniority: 'mid' as Contact['seniority'],
            email: c.email || '',
            phone: c.phone || c.mobile || '',
            phoneNumbers: (c.phone || c.mobile) ? [{ value: c.phone || c.mobile, label: 'Work' as const, preferred: true }] : [],
            privateEmail: '',
            status: 'unknown' as Contact['status'],
            engagementScore: 50,
            linkedIn: c.linkedin_url || '',
            notes: [] as any,
            contactOwner: '',
            lastContact: '',
            _companyName: c.crm_companies?.name || '',
            _companyId: c.company_id || '',
            _ownerId: null,
            _source: 'crm_contacts',
          });
        }
      }

      return merged;
    },
    enabled: !!workspaceId,
  });

  const allContacts = dbContacts;
  const isCompanyScoped = !!companyFilterId;
  const companyName = filterCompany?.name || '';
  const totalLabel = isCompanyScoped
    ? `${allContacts.length} contacts at ${companyName}`
    : `${allContacts.length} contacts`;

  // Get unique values for filters
  const departments = useMemo(() => {
    const depts = new Set(allContacts.map((c) => c.department).filter(Boolean));
    return Array.from(depts).sort() as string[];
  }, [allContacts]);

  // Owner filter removed — owner_id is a UUID with no profiles table mapping yet

  const statuses = ["unknown", "new", "warm", "engaged", "champion", "blocker"];

  // Filter contacts (client-side for department/status; debounced search)
  const hasActiveFilters = departmentFilter !== "all" || statusFilter !== "all" || assignedFilter !== "all" || debouncedSearch !== "";

  const filteredContacts = useMemo(() => {
    if (import.meta.env.DEV) {
      console.debug('[ContactsDatabase] filter state:', {
        debouncedSearch,
        departmentFilter,
        statusFilter,
        assignedFilter,
      });
    }

    return allContacts.filter((contact) => {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch =
        !debouncedSearch ||
        contact.name.toLowerCase().includes(searchLower) ||
        (contact as any)._companyName?.toLowerCase().includes(searchLower) ||
        contact.department.toLowerCase().includes(searchLower) ||
        contact.title.toLowerCase().includes(searchLower);

      const matchesDepartment =
        departmentFilter === "all" || contact.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;

      // "Assigned to me" compares owner_id to current auth user
      const matchesAssigned =
        assignedFilter === "all" || 
        (assignedFilter === "assigned-to-me" && (contact as any)._ownerId === user?.id);

      return matchesSearch && matchesDepartment && matchesStatus && matchesAssigned;
    });
  }, [allContacts, debouncedSearch, departmentFilter, statusFilter, assignedFilter, user?.id]);

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

  // Open Contact Record — navigate to full page
  const openContactRecord = (contact: Contact) => {
    navigate(`/contacts/${contact.id}`);
  };

  // Open Company panel from Contact Record
  const handleOpenCompany = () => {
    setCompanyPanelOpen(true);
  };

  const handleViewOrgChart = () => {
    if (companyFilterId) {
      navigate(`/canvas?company=${companyFilterId}`);
    } else {
      navigate("/canvas");
    }
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
  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);

  // Duplicate count for badge
  const duplicateCount = useMemo(() => {
    const nameMap = new Map<string, number>();
    for (const c of allContacts) {
      const key = c.name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      if (!key) continue;
      nameMap.set(key, (nameMap.get(key) || 0) + 1);
    }
    return Array.from(nameMap.values()).filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  }, [allContacts]);

  const handleAddContact = async (contact: Contact) => {
    if (!workspaceId) {
      toast.error("No workspace selected");
      return;
    }
    try {
      const { error } = await supabase.from("contacts").insert({
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        email_private: contact.privateEmail || null,
        department: contact.department || null,
        title: contact.title || null,
        seniority: contact.seniority || null,
        status: contact.status || "new",
        team_id: workspaceId,
        owner_id: user?.id || null,
        company_id: companyFilterId || null,
      });
      if (error) throw error;

      // Sync to crm_contacts so email/SMS tools can find this contact
      try {
        const nameParts = contact.name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
        
        // If there's a company filter, try to find the matching crm_companies record
        let crmCompanyId: string | null = null;
        if (companyFilterId) {
          const { data: coreCompany } = await supabase.from('companies').select('name').eq('id', companyFilterId).single();
          if (coreCompany?.name) {
            const { data: crmCompany } = await supabase.from('crm_companies' as any).select('id').ilike('name', coreCompany.name).limit(1).single();
            crmCompanyId = (crmCompany as any)?.id || null;
          }
        }

        await supabase.from('crm_contacts' as any).insert({
          first_name: firstName,
          last_name: lastName,
          email: contact.email || null,
          phone: contact.phone || null,
          job_title: contact.title || null,
          company_id: crmCompanyId,
          team_id: workspaceId,
          created_by: user?.id || null,
        } as any);
      } catch (syncErr) {
        console.warn('[ContactsDatabase] CRM contact sync failed (non-critical):', syncErr);
      }

      toast.success(`${contact.name} added to database`);
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm_contacts"] });
    } catch (err: any) {
      console.error("[ContactsDatabase] Insert contact failed:", err);
      toast.error(`Failed to add contact: ${err.message}`);
    }
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
      return;
    }

    // TODO: Update via Supabase in production
    toast.success("Contact assignment saved");
    
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
            <div className="flex items-center gap-3">
              {returnTo === "outreach" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(returnToCampaignId ? `/outreach?campaignId=${returnToCampaignId}` : '/outreach')}
                  className="shrink-0"
                  title="Back to Outreach"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {isCompanyScoped && !returnTo && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/companies')}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {isCompanyScoped ? `${companyName} — Contacts` : 'Contacts Database'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk: Add to Outreach */}
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => setShowAddToOutreach(true)}
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Add to Outreach…
                  </Button>
                  {perm.canSeeDeleteOption && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={perm.canDeleteDirectly ? "gap-1.5 text-destructive hover:text-destructive" : "gap-1.5 text-amber-500 hover:text-amber-600"}
                      onClick={async () => {
                        const ids = Array.from(selectedIds);
                        for (const cid of ids) {
                          const contact = filteredContacts.find((c: any) => c.id === cid);
                          if (perm.canDeleteDirectly) {
                            await softDelete.mutateAsync({
                              recordType: "contacts",
                              recordId: cid,
                              recordName: contact?.name || "Unknown",
                              reason: "Bulk deletion",
                            });
                          } else {
                            await requestDeletion.mutateAsync({
                              recordType: "contacts",
                              recordId: cid,
                              recordName: contact?.name || "Unknown",
                              reason: "Bulk deletion request",
                            });
                          }
                        }
                        setSelectedIds(new Set());
                      }}
                      disabled={softDelete.isPending || requestDeletion.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {perm.canDeleteDirectly ? "Delete Selected" : "Request Deletion"}
                    </Button>
                  )}
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAddContactModal(true)}
                      disabled={!canInsert}
                      data-jarvis-id="add-contact-button"
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
                        <Button variant="outline" size="sm" className="gap-2" disabled={!canInsert} data-jarvis-id="import-button">
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
              {duplicateCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setShowDuplicatePanel(true)}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {duplicateCount} Duplicate{duplicateCount > 1 ? "s" : ""}
                </Button>
              )}
              <Button variant="default" size="sm" onClick={handleViewOrgChart} data-jarvis-id="contacts-view-orgchart-button">
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
              data-jarvis-id="contacts-search-input"
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
          {/* Owner filter removed — owner_id is a UUID, no display name available yet */}
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
        <div className="rounded-xl border border-border bg-card overflow-visible relative" style={{ borderLeft: '4px solid hsl(199 89% 48%)' }}>
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            maxHeight="calc(100vh - 280px)"
            leftPinnedWidth={280}
          >
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted">
                  {/* Checkbox col */}
                  <TableHead
                    className="w-10"
                    style={{ background: "hsl(var(--muted))" }}
                  >
                    <Checkbox
                      checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold whitespace-nowrap"
                    style={{ 
                      minWidth: 100,
                      background: "hsl(var(--muted))",
                    }}
                  >
                    Data Quality
                  </TableHead>
                  <TableHead 
                    className="font-semibold whitespace-nowrap"
                    style={{ 
                      minWidth: 180,
                      background: "hsl(var(--muted))",
                    }}
                  >
                    Name
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Company</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Department</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Job Title</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Seniority</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Email</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Private Email</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Phone</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Status</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Owner</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ position: "relative", zIndex: 1 }}>Last Contacted</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted w-[120px]" style={{ position: "relative", zIndex: 1 }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredContacts.map((contact, index) => {
                const isReady = isContactReady(contact);
                const isSelected = selectedIds.has(contact.id) || selectedRowId === contact.id;
                const rowBg = isSelected
                  ? "rgba(99,102,241,0.12)"
                  : index % 2 === 1
                    ? "rgba(255,255,255,0.03)"
                    : "hsl(var(--card))";
                return (
                  <TableRow
                    key={contact.id}
                    style={{ background: rowBg }}
                    className="cursor-pointer transition-colors group hover:bg-muted/30"
                    onClick={(e) => handleRowClick(contact, e)}
                    onDoubleClick={(e) => handleRowDoubleClick(contact, e)}
                  >
                    {/* Checkbox cell */}
                    <TableCell
                      data-quality-action
                      className="w-10"
                      style={{ position: "sticky", left: 0, zIndex: 20, background: rowBg, backgroundClip: "padding-box" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            checked ? next.add(contact.id) : next.delete(contact.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell 
                      data-quality-action
                      style={{ 
                        position: "sticky", 
                        left: 40, 
                        zIndex: 20,
                        minWidth: 100,
                        background: rowBg,
                        backgroundClip: "padding-box",
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
                      className="font-medium"
                      style={{ 
                        position: "sticky", 
                        left: 140, 
                        zIndex: 20,
                        minWidth: 180,
                        boxShadow: "4px 0 8px -4px hsl(var(--foreground) / 0.12)",
                        background: rowBg,
                        backgroundClip: "padding-box",
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
                    <TableCell style={{ zIndex: 1 }}>{(contact as any)._companyName || "—"}</TableCell>
                    <TableCell style={{ zIndex: 1 }}>{contact.department || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell style={{ zIndex: 1 }}>{contact.title || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell style={{ zIndex: 1 }}>
                      <span className="text-muted-foreground">
                        {seniorityLabels[contact.seniority] || contact.seniority}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground" style={{ zIndex: 1 }}>
                      {contact.email}
                    </TableCell>
                    <TableCell data-quality-action style={{ zIndex: 1 }}>
                      <PrivateEmailEditor
                        privateEmail={contact.privateEmail}
                        onSave={(email) => {
                          toast.success("Private email updated");
                        }}
                      />
                    </TableCell>
                    <TableCell data-quality-action style={{ zIndex: 1 }}>
                      <PhoneInlineEditor
                        phoneNumbers={contact.phoneNumbers || []}
                        legacyPhone={contact.phone}
                        onSave={(phones: PhoneNumber[]) => {
                          toast.success("Phone updated");
                        }}
                      />
                    </TableCell>
                    <TableCell data-quality-action style={{ zIndex: 1 }}>
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
                          toast.success("Status updated");
                        }}
                        type="select"
                        options={statusOptions}
                        placeholder="Select status"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground" style={{ zIndex: 1 }}>
                      {(contact as any)._ownerId ? "Assigned" : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground" style={{ zIndex: 1 }}>
                      {contact.lastContact || "—"}
                    </TableCell>
                    <TableCell style={{ zIndex: 1 }}>
                      <RowInlineActions
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        workspaceId={workspaceId || ""}
                        entityName={contact.name}
                        entityEmail={contact.email}
                        entityPhone={contact.phone}
                        entityTitle={contact.title}
                        entityCompany={(contact as any)._companyName}
                        contactId={contact.id}
                        companyId={contact.companyId}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {allContacts.length === 0 ? (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-lg font-medium text-foreground">No contacts yet</p>
                        <p className="text-sm">Add your first contact or import from a file to get started.</p>
                        <div className="flex gap-2 mt-2">
                          <Button variant="default" size="sm" onClick={() => setShowAddContactModal(true)} disabled={!canInsert}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Contact
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setBulkImportMethod("file"); setShowBulkImportModal(true); }} disabled={!canInsert}>
                            <Upload className="h-4 w-4 mr-2" />
                            Import
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p>No contacts found matching your filters.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            setDepartmentFilter("all");
                            setStatusFilter("all");
                            setAssignedFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
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
        companyName={(selectedContact as any)?._companyName || ""}
        company={null as any}
        open={contactRecordOpen}
        onOpenChange={(open) => {
          setContactRecordOpen(open);
          if (!open) setSelectedContact(null);
        }}
        onOpenCompany={handleOpenCompany}
      />

      {/* Company Overview Panel */}
      <CompanyOverviewPanel
        company={null as any}
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
        companyName=""
      />

      {/* Smart Import Modal (AI-based import for images, docs, etc.) */}
      <SmartImportModal
        open={showAIImportModal}
        onOpenChange={setShowAIImportModal}
        context={{
          source: 'CONTACT',
          companyName: '',
        }}
      />

      {/* Bulk CSV/XLSX/OCR Import Modal - Shared Component */}
      <ImportCenterModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        entityType="contacts"
        initialMethod={bulkImportMethod}
        onImportComplete={(records) => {
          toast.success(`${records.length} contacts imported`);
        }}
      />

      <DuplicateDetectionPanel
        contacts={allContacts}
        open={showDuplicatePanel}
        onOpenChange={setShowDuplicatePanel}
        companyFilterId={companyFilterId}
      />

      {/* Add to Outreach bulk action modal */}
      <AddToOutreachModal
        open={showAddToOutreach}
        onOpenChange={(v) => {
          setShowAddToOutreach(v);
          if (!v) setSelectedIds(new Set());
        }}
        contacts={filteredContacts.filter((c) => selectedIds.has(c.id))}
        defaultCampaignId={returnToCampaignId}
      />
    </div>
  );
}
