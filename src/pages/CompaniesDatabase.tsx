import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockAccounts } from "@/lib/mock-data";
import { Account, RelationshipStatus, DataQuality } from "@/lib/types";
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
import {
  Search,
  Plus,
  Building2,
  Network,
  MapPin,
  Phone,
  Globe,
  TrendingUp,
  Calendar,
  Shield,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Account | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  // Permissions
  const { role, canInsert, isLoading: permissionsLoading } = usePermissions();
  const insertTooltip = getPermissionTooltip("insert", role);

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
    if (!searchQuery) return mockAccounts;
    const searchLower = searchQuery.toLowerCase();
    return mockAccounts.filter((account) =>
      account.name.toLowerCase().includes(searchLower) ||
      account.industry.toLowerCase().includes(searchLower) ||
      account.headquarters?.toLowerCase().includes(searchLower) ||
      account.accountManager?.name.toLowerCase().includes(searchLower)
    );
  }, [searchQuery]);

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
    setSelectedCompany(account);
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
    console.log("Add company clicked");
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
              <TeamManagementPanel />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleAddCompany}
                      disabled={!canInsert}
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
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 280px)"
          >
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-muted/95 backdrop-blur-sm">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className={cn(isSomeSelected && "data-[state=checked]:bg-primary/50")}
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
                        selectedIds.has(account.id) && "bg-primary/5"
                      )}
                      onClick={(e) => handleRowClick(account, e)}
                    >
                      <TableCell data-checkbox>
                        <Checkbox
                          checked={selectedIds.has(account.id)}
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
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
          Showing {filteredCompanies.length} of {mockAccounts.length} companies
        </div>
      </div>

      {/* Company Record Panel */}
      <CompanyOverviewPanel
        company={selectedCompany}
        open={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        onOpenCanvas={handleOpenCanvas}
        onViewContacts={handleViewContacts}
      />
    </div>
  );
}
