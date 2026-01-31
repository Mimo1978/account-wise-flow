import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockAccounts } from "@/lib/mock-data";
import { Account } from "@/lib/types";
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
  Users,
  TrendingUp,
  Calendar,
  ExternalLink,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { cn } from "@/lib/utils";

const getEngagementColor = (score: number) => {
  if (score >= 80) return "bg-accent text-accent-foreground";
  if (score >= 60) return "bg-primary/10 text-primary";
  if (score >= 40) return "bg-secondary text-secondary-foreground";
  return "bg-muted text-muted-foreground";
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
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

  // Row click opens overview panel
  const handleRowClick = (account: Account, e: React.MouseEvent) => {
    // Don't open panel if clicking checkbox
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
    
    // Navigate to canvas with selected companies
    const companyIds = Array.from(selectedIds).join(",");
    navigate(`/canvas?companies=${encodeURIComponent(companyIds)}`);
  };

  const handleViewContacts = (account: Account) => {
    navigate(`/canvas?company=${encodeURIComponent(account.id)}&view=database`);
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
                {filteredCompanies.length} companies in workspace
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
              placeholder="Search companies by name, industry, or owner..."
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

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 280px)"
          >
            <Table className="min-w-[1100px]">
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
                  <TableHead className="font-semibold whitespace-nowrap">Industry</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Account Owner</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Engagement
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Last Activity
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Contacts
                    </div>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((account) => (
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
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="hover:text-primary transition-colors">
                          {account.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {account.industry}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.accountManager ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                            {account.accountManager.name.charAt(0)}
                          </div>
                          <span className="text-sm">{account.accountManager.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getEngagementColor(account.engagementScore)}>
                        {account.engagementScore}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(account.lastInteraction || account.lastUpdated)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{account.contacts.length}</span>
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
                ))}
                {filteredCompanies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

      {/* Company Overview Panel */}
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
