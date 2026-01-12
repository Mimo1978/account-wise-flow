import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockAccounts } from "@/lib/mock-data";
import { Account } from "@/lib/types";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import { TeamManagementPanel } from "@/components/admin/TeamManagementPanel";
import {
  Search,
  Plus,
  Building2,
  Network,
  Database,
  Users,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";

const getEngagementColor = (score: number) => {
  if (score >= 80) return "bg-green-500/20 text-green-400";
  if (score >= 60) return "bg-blue-500/20 text-blue-400";
  if (score >= 40) return "bg-yellow-500/20 text-yellow-400";
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

  const handleRowClick = (account: Account) => {
    setSelectedCompany(account);
  };

  const handleViewCanvas = () => {
    if (selectedCompany) {
      // Navigate to canvas with company context
      navigate(`/canvas?company=${encodeURIComponent(selectedCompany.id)}`);
    }
    setSelectedCompany(null);
  };

  const handleViewDatabase = () => {
    if (selectedCompany) {
      // Navigate to canvas database view with company context
      navigate(`/canvas?company=${encodeURIComponent(selectedCompany.id)}&view=database`);
    }
    setSelectedCompany(null);
  };

  const handleAddCompany = () => {
    // Placeholder for add company functionality
    console.log("Add company clicked");
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

      {/* Search */}
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
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 280px)"
          >
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-muted/95 backdrop-blur-sm">
                  <TableHead className="font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Name
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Industry</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Region</TableHead>
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
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredCompanies.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(account)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      {account.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {account.industry}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {/* Region not in current data model, showing placeholder */}
                    —
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
                </TableRow>
              ))}
              {filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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

      {/* Company Context Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedCompany?.industry} • {selectedCompany?.contacts.length} contacts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={handleViewCanvas}
            >
              <Network className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">View on Canvas</div>
                <div className="text-xs text-muted-foreground">
                  Visual org chart view
                </div>
              </div>
            </Button>
            <Button
              className="w-full justify-start gap-3 h-12"
              variant="outline"
              onClick={handleViewDatabase}
            >
              <Database className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">View Database</div>
                <div className="text-xs text-muted-foreground">
                  Table view with all contacts
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
