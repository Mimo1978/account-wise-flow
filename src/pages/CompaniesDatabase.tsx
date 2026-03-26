import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { Account, RelationshipStatus, DataQuality } from "@/lib/types";
import { CompaniesEmptyState } from "@/components/canvas/EmptyStates";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import { TeamManagementPanel } from "@/components/admin/TeamManagementPanel";
import { CompanyOverviewPanel } from "@/components/company/CompanyOverviewPanel";
import { CreateCompanyModal } from "@/components/company/CreateCompanyModal";
import { ImportCenterModal } from "@/components/import/ImportCenterModal";
import { ImportDropdown } from "@/components/import/ImportDropdown";
import { SmartImportModal } from "@/components/import/SmartImportModal";
import { ImportMethod } from "@/components/import/ImportCenterTypes";
import {
  Search,
  Plus,
  Building2,
  Network,
  MapPin,
  Phone,
  Globe,
  Calendar,
  Shield,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { cn } from "@/lib/utils";
import { useDeletionPermission, useHardDelete, useRequestDeletion } from "@/hooks/use-deletion";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { toast } from "sonner";

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

export default function CompaniesDatabase() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { mode } = useWorkspaceMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Account | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSmartImportModalOpen, setIsSmartImportModalOpen] = useState(false);
  const [importMethod, setImportMethod] = useState<ImportMethod>("file");
  
  // Permissions
  const { role, canInsert, isLoading: permissionsLoading } = usePermissions();
  const insertTooltip = getPermissionTooltip("insert", role);
  const perm = useDeletionPermission();
  const softDelete = useHardDelete();
  const requestDeletion = useRequestDeletion();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  
  // Fetch companies from workspace
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      // Fetch from core companies table (workspace-scoped)
      const { data: coreData, error: coreError } = await supabase
        .from('companies')
        .select('*')
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null)
        .order('name');

      // Fetch from crm_companies table
      const { data: crmData } = await supabase
        .from('crm_companies' as any)
        .select('*')
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null)
        .order('name');

      if (coreError) {
        console.error('Error fetching companies:', coreError);
        return [];
      }

      if (import.meta.env.DEV) {
        console.debug('[CompaniesDatabase] query:', { workspaceId: currentWorkspace?.id, coreCount: coreData?.length ?? 0, crmCount: (crmData as any[])?.length ?? 0 });
      }

      // Merge and deduplicate by name (case-insensitive), core takes priority
      const seen = new Set<string>();
      const merged: any[] = [];

      for (const company of (coreData || [])) {
        const key = company.name?.toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push(company);
        }
      }

      for (const company of ((crmData as any[]) || [])) {
        const key = company.name?.toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push({
            ...company,
            headquarters: [company.city, company.country].filter(Boolean).join(', ') || null,
            _source: 'crm_companies',
          });
        }
      }

      merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      // Transform to Account format
      return merged.map((company: any) => ({
        id: company.id,
        name: company.name,
        industry: company.industry || 'Other',
        headquarters: company.headquarters,
        switchboard: company.switchboard,
        regions: company.regions || [],
        relationshipStatus: company.relationship_status || 'warm',
        accountManager: company.account_manager ? { name: company.account_manager, title: 'Account Manager' } : undefined,
        contacts: [],
        lastUpdated: company.updated_at,
        lastInteraction: company.updated_at,
        engagementScore: 50,
        dataQuality: (company.data_quality as DataQuality) || 'partial',
      }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // Check if this is the first visit to show scroll hint
  useEffect(() => {
    const visitedKey = "companies-database-visited";
    if (!sessionStorage.getItem(visitedKey)) {
      setIsFirstVisit(true);
      sessionStorage.setItem(visitedKey, "true");
    }
  }, []);

  // Filter companies by search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const searchLower = searchQuery.toLowerCase();
    return companies.filter((account) =>
      account.name.toLowerCase().includes(searchLower) ||
      account.industry.toLowerCase().includes(searchLower) ||
      account.headquarters?.toLowerCase().includes(searchLower) ||
      account.accountManager?.name.toLowerCase().includes(searchLower)
    );
  }, [searchQuery, companies]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCompanies.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
  };

  const isAllSelected = filteredCompanies.length > 0 && 
    filteredCompanies.every((c) => selectedIds.has(c.id));

  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  // Row click opens Company Record panel
  const handleRowClick = (account: Account, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return;
    }
    navigate(`/companies/${account.id}`);
  };

  // Canvas navigation
  const handleOpenCanvas = (account: Account) => {
    navigate(`/canvas?company=${encodeURIComponent(account.id)}`);
    setSelectedCompany(null);
  };

  const handleViewOnCanvas = () => {
    if (selectedIds.size === 0) return;
    const companyIds = Array.from(selectedIds).join(",");
    navigate(`/canvas?companies=${encodeURIComponent(companyIds)}`);
  };

  const handleViewContacts = (account: Account) => {
    navigate(`/contacts?company=${encodeURIComponent(account.id)}`);
    setSelectedCompany(null);
  };

  const handleAddCompany = () => {
    setIsCreateModalOpen(true);
  };

  const handleCompanyCreated = (company: Account) => {
    // Open the company record panel with the newly created company
    setSelectedCompany(company);
    // The query will automatically update via cache invalidation
  };

  const handleCompaniesImported = () => {
    // Refetch companies after import
    // The query will automatically update via cache invalidation
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="bg-background">
      {/* Page Sub-header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Companies
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredCompanies.length} companies in workspace • Company-first view
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span data-jarvis-id="companies-team-settings"><TeamManagementPanel /></span>
              
              {/* Import Dropdown - Shared Component */}
              <ImportDropdown
                entityType="companies"
                onImportClick={(method) => {
                  setImportMethod(method);
                  setIsImportModalOpen(true);
                }}
                onSmartImportClick={() => setIsSmartImportModalOpen(true)}
                disabled={!canInsert}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleAddCompany}
                      disabled={!canInsert}
                      data-jarvis-id="add-company-button"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </Button>
                  </span>
                </TooltipTrigger>
                {insertTooltip && (
                  <TooltipContent side="bottom">
                    <p className="text-sm">{insertTooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State for Real Mode */}
      {companiesLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      ) : companies.length === 0 ? (
        <CompaniesEmptyState
          onCreateClick={handleAddCompany}
          onImportClick={() => {
            setImportMethod('file');
            setIsImportModalOpen(true);
          }}
        />
      ) : (
        <>
      {/* Search and Selection Bar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, industry, HQ, or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-jarvis-id="companies-search-input"
            />
          </div>
          
          {/* Selection Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-primary/20 bg-primary/5">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                onClick={handleViewOnCanvas}
                className="gap-2"
              >
                <Network className="h-4 w-4" />
                View on Canvas
              </Button>
              {perm.canSeeDeleteOption && (
                <Button
                  size="sm"
                  variant="outline"
                  className={perm.canDeleteDirectly ? "gap-1.5 text-destructive hover:text-destructive" : "gap-1.5 text-amber-500 hover:text-amber-600"}
                  onClick={async () => {
                    if (perm.canDeleteDirectly) {
                      const ids = Array.from(selectedIds);
                      for (const cid of ids) {
                        const company = filteredCompanies.find(c => c.id === cid);
                        await softDelete.mutateAsync({
                          recordType: "companies",
                          recordId: cid,
                          recordName: company?.name || "Unknown",
                          reason: "Bulk deletion",
                        });
                      }
                      setSelectedIds(new Set());
                    } else {
                      const ids = Array.from(selectedIds);
                      for (const cid of ids) {
                        const company = filteredCompanies.find(c => c.id === cid);
                        await requestDeletion.mutateAsync({
                          recordType: "companies",
                          recordId: cid,
                          recordName: company?.name || "Unknown",
                          reason: "Bulk deletion request",
                        });
                      }
                      setSelectedIds(new Set());
                    }
                  }}
                  disabled={softDelete.isPending || requestDeletion.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {perm.canDeleteDirectly ? "Delete Selected" : "Request Deletion"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Company-Level Table (NO contacts column) */}
        <div className="rounded-xl border border-border bg-card overflow-hidden relative" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 280px)"
            leftPinnedWidth={260}
          >
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead 
                    className="w-12 bg-muted"
                    style={{ 
                      position: "sticky", 
                      left: 0, 
                      zIndex: 31,
                      width: 48,
                      minWidth: 48,
                    }}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className={cn(isSomeSelected && "data-[state=checked]:bg-primary/50")}
                    />
                  </TableHead>
                  <TableHead 
                    className="font-semibold whitespace-nowrap bg-muted"
                    style={{ 
                      position: "sticky", 
                      left: 48, 
                      zIndex: 30,
                      minWidth: 200,
                      boxShadow: "4px 0 8px -4px hsl(var(--foreground) / 0.12)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Name
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted text-center" style={{ zIndex: 10, width: 90 }}>
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4" />
                      Contacts
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted text-center" style={{ zIndex: 10, width: 100 }}>
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Score
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Headquarters
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Switchboard
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>Industry</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Regions
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    Status
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Account Owner
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Last Activity
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap bg-muted" style={{ zIndex: 10 }}>
                    Data Quality
                  </TableHead>
                  <TableHead className="w-12 bg-muted" style={{ zIndex: 10 }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((account, index) => {
                  const statusConfig = getRelationshipStatusConfig(account.relationshipStatus);
                  const qualityConfig = getDataQualityConfig(account.dataQuality);
                  const isSelected = selectedIds.has(account.id);
                  const rowBg = isSelected
                    ? "rgba(99,102,241,0.12)"
                    : index % 2 === 1
                      ? "rgba(255,255,255,0.03)"
                      : "transparent";
                  
                  return (
                    <TableRow
                      key={account.id}
                      style={{ background: rowBg }}
                      className="cursor-pointer transition-colors group hover:bg-muted/30"
                      onClick={(e) => handleRowClick(account, e)}
                    >
                      <TableCell 
                        data-checkbox 
                        style={{ 
                          position: "sticky", 
                          left: 0, 
                          zIndex: 21,
                          width: 48,
                          minWidth: 48,
                          background: rowBg,
                        }}
                      >
                        <Checkbox
                          checked={selectedIds.has(account.id)}
                          onCheckedChange={(checked) => 
                            handleSelectRow(account.id, checked as boolean)
                          }
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${account.name}`}
                        />
                      </TableCell>
                      <TableCell 
                        className="font-medium"
                        style={{ 
                          position: "sticky", 
                          left: 48, 
                          zIndex: 20,
                          minWidth: 200,
                          boxShadow: "4px 0 8px -4px hsl(var(--foreground) / 0.12)",
                          background: rowBg,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="hover:text-primary transition-colors truncate">
                            {account.name}
                          </span>
                        </div>
                      </TableCell>
                      {/* Contacts Count */}
                      <TableCell className="text-center" style={{ zIndex: 1 }}>
                        {account.contacts.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-default",
                                account.contacts.length >= 10 
                                  ? "bg-primary/15 text-primary" 
                                  : account.contacts.length >= 5 
                                    ? "bg-accent/50 text-accent-foreground" 
                                    : "bg-muted text-muted-foreground"
                              )}>
                                <Users className="h-3 w-3" />
                                {account.contacts.length}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-sm">{account.contacts.length} contacts mapped</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      {/* Engagement Score */}
                      <TableCell className="text-center" style={{ zIndex: 1 }}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold cursor-default",
                              account.engagementScore >= 70 
                                ? "bg-accent text-accent-foreground" 
                                : account.engagementScore >= 40 
                                  ? "bg-primary/15 text-primary" 
                                  : "bg-muted text-muted-foreground"
                            )}>
                              {account.engagementScore}%
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-sm">Engagement score based on activity</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
                        <span className="text-sm text-muted-foreground">
                          {account.headquarters || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
                        <span className="text-sm text-muted-foreground font-mono">
                          {account.switchboard || "—"}
                        </span>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
                        <Badge variant="secondary" className="font-normal">
                          {account.industry}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
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
                      <TableCell style={{ zIndex: 1 }}>
                        <Badge className={cn("font-normal", statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
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
                      <TableCell className="text-muted-foreground text-sm" style={{ zIndex: 1 }}>
                        {formatDate(account.lastInteraction || account.lastUpdated)}
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
                        <div className={cn("flex items-center gap-1 text-sm", qualityConfig.className)}>
                          {qualityConfig.icon && <qualityConfig.icon className="h-3.5 w-3.5" />}
                          <span>{qualityConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell style={{ zIndex: 1 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCompany(account);
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
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      No companies found matching "{searchQuery}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </div>

        {/* Footer */}
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredCompanies.length} of {companies.length} companies
        </div>
      </div>
        </>
      )}

      {/* Company Record Panel */}
      <CompanyOverviewPanel
        company={selectedCompany}
        open={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onOpenCanvas={handleOpenCanvas}
        onViewContacts={handleViewContacts}
      />

      {/* Create Company Modal */}
      <CreateCompanyModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCompanyCreated={handleCompanyCreated}
      />

      {/* Import Center Modal - Shared Component */}
      <ImportCenterModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        entityType="companies"
        onImportComplete={handleCompaniesImported}
        initialMethod={importMethod}
      />

      {/* Smart Import Modal for Word/Images/AI */}
      <SmartImportModal
        open={isSmartImportModalOpen}
        onOpenChange={setIsSmartImportModalOpen}
        context={{
          source: 'COMPANY',
          companyId: selectedCompany?.id,
          companyName: selectedCompany?.name,
        }}
        onComplete={handleCompaniesImported}
      />
    </div>
  );
}
