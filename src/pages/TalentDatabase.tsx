import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { mockTalents, roleTypeOptions } from "@/lib/mock-talent";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus, TalentCvSource } from "@/lib/types";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TalentProfilePanel } from "@/components/talent/TalentProfilePanel";
import { TalentImportModal } from "@/components/talent/TalentImportModal";
import { TalentColumnPicker } from "@/components/talent/TalentColumnPicker";
import { TalentQuickView } from "@/components/talent/TalentQuickView";
import { CVViewer } from "@/components/talent/CVViewer";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { useTableViewPreferences } from "@/components/canvas/TableViewControls";
import { useResizableColumns, ColumnConfig } from "@/hooks/use-resizable-columns";
import {
  Search,
  Plus,
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Upload,
  FileText,
  Image,
  Linkedin,
  PenLine,
  Mail,
  Phone,
  GripVertical,
  ChevronDown,
  Layers,
  MousePointer2,
  Maximize2,
  WrapText,
  Eye,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const availabilityColors: Record<TalentAvailability, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  interviewing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  deployed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const availabilityLabels: Record<TalentAvailability, string> = {
  available: "Available",
  interviewing: "Interviewing",
  deployed: "On Project",
};

const statusColors: Record<TalentStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  new: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "on-hold": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-muted text-muted-foreground border-muted",
};

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

const cvSourceIcons: Record<TalentCvSource, React.ReactNode> = {
  upload: <FileText className="h-3.5 w-3.5" />,
  image: <Image className="h-3.5 w-3.5" />,
  linkedin: <Linkedin className="h-3.5 w-3.5" />,
  manual: <PenLine className="h-3.5 w-3.5" />,
};

const cvSourceLabels: Record<TalentCvSource, string> = {
  upload: "CV Upload",
  image: "Image/Scan",
  linkedin: "LinkedIn",
  manual: "Manual Entry",
};

// Column configuration
const initialColumns: ColumnConfig[] = [
  // Core
  { id: "name", label: "Name", category: "Core", minWidth: 160, defaultWidth: 200, visible: true },
  { id: "roleType", label: "Role / Title", category: "Core", minWidth: 120, defaultWidth: 160, visible: true },
  { id: "seniority", label: "Seniority", category: "Core", minWidth: 90, defaultWidth: 100, visible: true },
  { id: "skills", label: "Primary Skills", category: "Core", minWidth: 180, defaultWidth: 240, visible: true },
  { id: "availability", label: "Availability", category: "Core", minWidth: 110, defaultWidth: 120, visible: true },
  // Contact
  { id: "email", label: "Email", category: "Contact", minWidth: 180, defaultWidth: 220, visible: true },
  { id: "phone", label: "Phone", category: "Contact", minWidth: 130, defaultWidth: 150, visible: true },
  { id: "location", label: "Location", category: "Contact", minWidth: 120, defaultWidth: 150, visible: true },
  // AI-Derived
  { id: "aiOverview", label: "Experience Summary", category: "AI-Derived", minWidth: 200, defaultWidth: 300, visible: false },
  { id: "keySkills", label: "Key Skills (AI)", category: "AI-Derived", minWidth: 150, defaultWidth: 200, visible: false },
  // Operational
  { id: "lastUpdated", label: "Last Updated", category: "Operational", minWidth: 100, defaultWidth: 120, visible: true },
  { id: "cvSource", label: "CV Source", category: "Operational", minWidth: 100, defaultWidth: 110, visible: true },
];

export default function TalentDatabase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState<string>("all");
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCVViewer, setShowCVViewer] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [quickViewTalentId, setQuickViewTalentId] = useState<string | null>(null);

  // Persisted view preferences
  const [viewPreferences, setViewPreferences] = useTableViewPreferences("talent-table-view-prefs");

  // Check if this is the first visit to show scroll hint
  useEffect(() => {
    const visitedKey = "talent-database-visited";
    if (!sessionStorage.getItem(visitedKey)) {
      setIsFirstVisit(true);
      sessionStorage.setItem(visitedKey, "true");
    }
  }, []);

  const {
    columns,
    columnWidths,
    visibleColumns,
    handleResizeStart,
    toggleColumnVisibility,
    setAllColumnsVisibility,
  } = useResizableColumns(initialColumns);

  // Get unique role types from data
  const roleTypes = useMemo(() => {
    const types = new Set(mockTalents.map((t) => t.roleType));
    return Array.from(types).sort();
  }, []);

  // Filter talents
  const filteredTalents = useMemo(() => {
    return mockTalents.filter((talent) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        talent.name.toLowerCase().includes(searchLower) ||
        talent.roleType.toLowerCase().includes(searchLower) ||
        talent.email.toLowerCase().includes(searchLower) ||
        talent.skills.some((skill) =>
          skill.toLowerCase().includes(searchLower)
        );

      const matchesAvailability =
        availabilityFilter === "all" || talent.availability === availabilityFilter;

      const matchesRoleType =
        roleTypeFilter === "all" || talent.roleType === roleTypeFilter;

      return matchesSearch && matchesAvailability && matchesRoleType;
    });
  }, [searchQuery, availabilityFilter, roleTypeFilter]);

  const handleRowClick = (talent: Talent) => {
    setSelectedTalent(talent);
  };

  const handleAddTalent = () => {
    console.log("Add talent clicked");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTalents.map((t) => t.id)));
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

  const isAllSelected = filteredTalents.length > 0 && selectedIds.size === filteredTalents.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredTalents.length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const renderCellContent = (columnId: string, talent: Talent, wrapText: boolean = false) => {
    switch (columnId) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className={wrapText ? "font-medium" : "truncate font-medium"}>{talent.name}</span>
          </div>
        );
      case "roleType":
        return <span className={cn("text-sm", wrapText ? "" : "truncate")}>{talent.roleType}</span>;
      case "seniority":
        return (
          <span className="text-muted-foreground text-sm">
            {seniorityLabels[talent.seniority] || talent.seniority}
          </span>
        );
      case "skills":
        return (
          <div className="flex flex-wrap gap-1">
            {talent.skills.slice(0, 3).map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="text-xs font-normal"
              >
                {skill}
              </Badge>
            ))}
            {talent.skills.length > 3 && (
              <Badge variant="secondary" className="text-xs font-normal">
                +{talent.skills.length - 3}
              </Badge>
            )}
          </div>
        );
      case "availability":
        return (
          <Badge className={availabilityColors[talent.availability]}>
            {availabilityLabels[talent.availability]}
          </Badge>
        );
      case "email":
        return (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{talent.email}</span>
          </div>
        );
      case "phone":
        return (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{talent.phone}</span>
          </div>
        );
      case "location":
        return (
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            {talent.location ? (
              <>
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{talent.location}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        );
      case "aiOverview":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground line-clamp-2 cursor-help">
                {talent.aiOverview || "—"}
              </span>
            </TooltipTrigger>
            {talent.aiOverview && (
              <TooltipContent side="bottom" className="max-w-md">
                <p className="text-sm">{talent.aiOverview}</p>
              </TooltipContent>
            )}
          </Tooltip>
        );
      case "keySkills":
        // Key skills derived from AI - showing top skills with different styling
        return (
          <div className="flex flex-wrap gap-1">
            {talent.skills.slice(0, 4).map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-xs font-normal bg-primary/10 text-primary border-primary/20"
              >
                {skill}
              </Badge>
            ))}
          </div>
        );
      case "lastUpdated":
        return (
          <span className="text-muted-foreground text-sm">
            {formatDate(talent.lastUpdated)}
          </span>
        );
      case "cvSource":
        const source = talent.cvSource || "manual";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="gap-1.5 text-xs font-normal text-muted-foreground"
              >
                {cvSourceIcons[source]}
                {cvSourceLabels[source]}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Source: {cvSourceLabels[source]}</p>
            </TooltipContent>
          </Tooltip>
        );
      default:
        return "—";
    }
  };

  // Calculate total table width - use smaller widths when fit to screen is enabled
  const totalTableWidth = useMemo(() => {
    if (viewPreferences.fitToScreen) {
      return undefined; // Let table stretch to container width
    }
    const checkboxWidth = 40;
    const columnsWidth = visibleColumns.reduce(
      (sum, col) => sum + (columnWidths[col.id] || col.defaultWidth),
      0
    );
    return checkboxWidth + columnsWidth + 20; // 20px buffer
  }, [visibleColumns, columnWidths, viewPreferences.fitToScreen]);

  // Columns that should wrap text when wrapText is enabled
  const wrappableColumns = new Set(["name", "roleType", "seniority"]);

  // Get cell styles based on view preferences
  const getCellStyles = (columnId: string) => {
    const baseWidth = columnWidths[columnId] || visibleColumns.find(c => c.id === columnId)?.defaultWidth || 150;
    
    if (viewPreferences.fitToScreen) {
      // Proportional widths with ellipsis
      return {
        width: "auto",
        minWidth: Math.min(baseWidth * 0.6, 100),
        maxWidth: viewPreferences.wrapText && wrappableColumns.has(columnId) ? undefined : baseWidth,
      };
    }
    
    return {
      width: baseWidth,
      maxWidth: viewPreferences.wrapText && wrappableColumns.has(columnId) ? undefined : baseWidth,
    };
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
                  Talent Database
                </h1>
                <p className="text-sm text-muted-foreground">
                  {filteredTalents.length} candidates & contractors
                  {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View Preference Toggles */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={viewPreferences.fitToScreen}
                    onPressedChange={(pressed) => setViewPreferences(prev => ({ ...prev, fitToScreen: pressed }))}
                    size="sm"
                    aria-label="Fit to screen"
                    className="gap-1.5 text-xs px-2.5 h-8 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Fit
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Fit columns to screen width</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={viewPreferences.wrapText}
                    onPressedChange={(pressed) => setViewPreferences(prev => ({ ...prev, wrapText: pressed }))}
                    size="sm"
                    aria-label="Wrap text"
                    className="gap-1.5 text-xs px-2.5 h-8 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                  >
                    <WrapText className="h-3.5 w-3.5" />
                    Wrap
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Wrap text in Name, Role, Seniority</p>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6" />

              <TalentColumnPicker
                columns={columns}
                onToggleColumn={toggleColumnVisibility}
                onToggleAll={setAllColumnsVisibility}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Upload CV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log("Batch upload")}>
                    <Layers className="h-4 w-4 mr-2" />
                    Batch Upload
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log("Drag & drop")}>
                    <MousePointer2 className="h-4 w-4 mr-2" />
                    Drag & Drop
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => console.log("Import from LinkedIn")}>
                    <Linkedin className="h-4 w-4 mr-2" />
                    Import from LinkedIn
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="default" size="sm" onClick={handleAddTalent}>
                <Plus className="h-4 w-4 mr-2" />
                + Add Candidate
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, skill, role, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Availability</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="deployed">On Project</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleTypeFilter} onValueChange={setRoleTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Role Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Role Types</SelectItem>
              {roleTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table with Resizable Columns */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            stickyHeader
            maxHeight="calc(100vh - 320px)"
          >
            <Table style={{ minWidth: viewPreferences.fitToScreen ? undefined : `${totalTableWidth}px`, width: viewPreferences.fitToScreen ? '100%' : undefined }}>
              <TableHeader>
                <TableRow className="bg-muted/95 backdrop-blur-sm">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className={isSomeSelected ? "opacity-50" : ""}
                    />
                  </TableHead>
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(
                        "font-semibold relative group",
                        viewPreferences.fitToScreen ? "" : "whitespace-nowrap"
                      )}
                      style={getCellStyles(column.id)}
                    >
                      <div className="flex items-center justify-between pr-2">
                        <span className="truncate">{column.label}</span>
                      </div>
                      {/* Resize handle - hidden when fit to screen is active */}
                      {!viewPreferences.fitToScreen && (
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 bg-primary/50 hover:bg-primary transition-opacity"
                          onMouseDown={(e) => handleResizeStart(column.id, e)}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTalents.map((talent) => (
                  <TableRow
                    key={talent.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group/row"
                    onClick={() => handleRowClick(talent)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()} className="relative">
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={selectedIds.has(talent.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(talent.id, !!checked)
                          }
                          aria-label={`Select ${talent.name}`}
                        />
                        {/* Quick View Icon */}
                        <TalentQuickView
                          talent={talent}
                          open={quickViewTalentId === talent.id}
                          onOpenChange={(open) => setQuickViewTalentId(open ? talent.id : null)}
                          onViewFull={() => {
                            setQuickViewTalentId(null);
                            setSelectedTalent(talent);
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickViewTalentId(quickViewTalentId === talent.id ? null : talent.id);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          viewPreferences.wrapText && wrappableColumns.has(column.id)
                            ? "whitespace-normal"
                            : "whitespace-nowrap"
                        )}
                        style={getCellStyles(column.id)}
                      >
                        {renderCellContent(column.id, talent, viewPreferences.wrapText)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {filteredTalents.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length + 1}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No talent found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
          </ScrollableTableContainer>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredTalents.length} of {mockTalents.length} candidates
          </span>
          <span className="text-xs">
            {visibleColumns.length} of {columns.length} columns visible
          </span>
        </div>
      </div>

      {/* Talent Profile Side Panel */}
      <TalentProfilePanel
        talent={selectedTalent}
        open={!!selectedTalent && !showCVViewer}
        onClose={() => setSelectedTalent(null)}
        onSkillFilter={(skill) => setSearchQuery(skill)}
        onViewCV={() => setShowCVViewer(true)}
      />

      {/* CV Viewer */}
      <CVViewer
        talent={selectedTalent}
        open={showCVViewer}
        onClose={() => setShowCVViewer(false)}
        onBack={() => setShowCVViewer(false)}
      />

      {/* CV Import Modal */}
      <TalentImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={(talent) => {
          // In a real app, this would add to the database
          mockTalents.push(talent);
          setShowImportModal(false);
        }}
      />
    </div>
  );
}
