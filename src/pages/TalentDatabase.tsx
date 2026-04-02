import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useCandidates } from "@/hooks/use-candidates";
import { useBooleanSearch, BooleanSearchResult } from "@/hooks/use-boolean-search";
import { useSearchContext } from "@/contexts/SearchContext";
import { useCandidateDocumentCounts } from "@/hooks/use-candidate-document-counts";
import { mockTalents, roleTypeOptions } from "@/lib/mock-talent";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus, TalentCvSource } from "@/lib/types";
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
import { DocsColumnCell, DocsInlineIndicator } from "@/components/talent/DocsColumnCell";
import { SmartImportModal } from "@/components/import/SmartImportModal";
import { FastCVUpload } from "@/components/import/FastCVUpload";
import { ImportCenterModal } from "@/components/import/ImportCenterModal";
import { ImportMethod } from "@/components/import/ImportCenterTypes";
import { AddToOutreachModal } from "@/components/outreach/AddToOutreachModal";
import { TalentColumnPicker } from "@/components/talent/TalentColumnPicker";
import { TalentQuickView } from "@/components/talent/TalentQuickView";
import { ViewPresetsDropdown } from "@/components/talent/ViewPresetsDropdown";
import { InlineSearchBar } from "@/components/talent/InlineSearchBar";
import { SearchResultCard } from "@/components/talent/SearchResultCard";
import { MatchIndicatorBadge } from "@/components/talent/MatchIndicatorBadge";
import { MatchSnippetsPanel } from "@/components/talent/MatchSnippetsPanel";
import { CVViewer } from "@/components/talent/CVViewer";
import { AddCandidateModal } from "@/components/talent/AddCandidateModal";
import { ScrollableTableContainer } from "@/components/canvas/ScrollableTableContainer";
import { useTableViewPreferences } from "@/components/canvas/TableViewControls";
import { PinnedEdgeFade, PinnedEdgeFadeRight } from "@/components/ui/pinned-edge-fade";
import { useResizableColumns, ColumnConfig } from "@/hooks/use-resizable-columns";
import { useColumnPinning } from "@/hooks/use-column-pinning";
import { useViewPresets } from "@/hooks/use-view-presets";
import { useResponsiveColumns } from "@/hooks/use-responsive-columns";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import {
  Plus,
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
  ScanLine,
  LayoutList,
  Download,
  Megaphone,
  Clock,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { RowInlineActions } from "@/components/outreach/RowInlineActions";

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
  { id: "docs", label: "Docs", category: "Operational", minWidth: 80, defaultWidth: 90, visible: true },
];

export default function TalentDatabase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const returnToCampaignId = searchParams.get("campaignId") ?? undefined;
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState<string>("all");
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFastUpload, setShowFastUpload] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportMethod, setBulkImportMethod] = useState<ImportMethod>("file");
  const [showCVViewer, setShowCVViewer] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [showAddToOutreach, setShowAddToOutreach] = useState(false);
  const [quickViewTalentId, setQuickViewTalentId] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [snippetsPanelResult, setSnippetsPanelResult] = useState<BooleanSearchResult | null>(null);
  const [showAddCandidate, setShowAddCandidate] = useState(false);

  // Boolean search hook
  const booleanSearch = useBooleanSearch({ debounceMs: 500 });
  
  // Search context for passing results to profile page
  const searchContext = useSearchContext();

  // Fetch real candidates from database
  const { 
    candidates: dbCandidates, 
    isLoading: candidatesLoading, 
    refetch: refetchCandidates,
    invalidateCandidates 
  } = useCandidates();

  // Use real data if available, fallback to mock for demo
  const allTalents = useMemo(() => {
    // If we have real candidates, use them; otherwise use mock data for demo purposes
    if (dbCandidates.length > 0) {
      return dbCandidates;
    }
    // Fallback to mock data when no real candidates (for demo workspace)
    return mockTalents;
  }, [dbCandidates]);

  // Fetch document counts for all visible talents
  const talentIds = useMemo(() => allTalents.map(t => t.id), [allTalents]);
  const { counts: documentCounts, isLoading: docsLoading } = useCandidateDocumentCounts({
    talentIds,
    enabled: talentIds.length > 0,
  });

  // Permissions
  const { role, canInsert, canEdit, isLoading: permissionsLoading } = usePermissions();
  const insertTooltip = getPermissionTooltip("insert", role);
  const editTooltip = getPermissionTooltip("edit", role);

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
    setColumnsVisibility,
  } = useResizableColumns(initialColumns);

  // View presets
  const allColumnIds = useMemo(() => initialColumns.map((c) => c.id), []);
  const {
    allPresets,
    activePreset,
    activePresetId,
    selectPreset,
    saveCustomPreset,
    updateCustomPreset,
    deleteCustomPreset,
    isCurrentViewModified,
  } = useViewPresets(allColumnIds);

  // Apply preset when it changes
  useEffect(() => {
    if (activePreset) {
      setColumnsVisibility(activePreset.columns);
    }
  }, [activePresetId, activePreset, setColumnsVisibility]);

  // Column pinning
  const {
    isPinned,
    canPin,
    togglePin,
    getLeftPinnedColumns,
    getRightPinnedColumns,
  } = useColumnPinning();

  // Responsive column hiding
  const {
    responsiveVisibleColumns,
    hiddenCount: responsiveHiddenCount,
  } = useResponsiveColumns(visibleColumns);

  // State for column picker popover (to open from hidden indicator)
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  // Get unique role types from data
  const roleTypes = useMemo(() => {
    const types = new Set(allTalents.map((t) => t.roleType));
    return Array.from(types).sort();
  }, [allTalents]);

  // Filter talents - use Boolean search results if active, otherwise filter locally
  const filteredTalents = useMemo(() => {
    // If Boolean search is active and has results, use those
    if (booleanSearch.isActive && booleanSearch.isBooleanMode && booleanSearch.hasResults) {
      const searchResultIds = new Set(booleanSearch.results.map(r => r.candidate.id));
      return allTalents.filter((talent) => {
        const matchesSearch = searchResultIds.has(talent.id);
        const matchesAvailability =
          availabilityFilter === "all" || talent.availability === availabilityFilter;
        const matchesRoleType =
          roleTypeFilter === "all" || talent.roleType === roleTypeFilter;
        return matchesSearch && matchesAvailability && matchesRoleType;
      });
    }

    // For simple search or no search, filter locally
    return allTalents.filter((talent) => {
      const searchLower = booleanSearch.query.toLowerCase();
      const matchesSearch =
        !booleanSearch.query ||
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
  }, [booleanSearch.query, booleanSearch.isActive, booleanSearch.isBooleanMode, booleanSearch.hasResults, booleanSearch.results, availabilityFilter, roleTypeFilter, allTalents]);

  const handleRowClick = (talent: Talent) => {
    // Store search result if in Boolean mode
    if (booleanSearch.isBooleanMode && booleanSearch.hasResults) {
      const searchResult = booleanSearch.results.find(r => r.candidate.id === talent.id);
      if (searchResult) {
        searchContext.storeSearchResult(talent.id, searchResult);
      }
    }
    // Navigate to the full profile page
    navigate(`/talent/${talent.id}`);
  };

  const handleAddTalent = () => {
    setShowAddCandidate(true);
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
    // Get document count for inline indicator
    const talentDocs = documentCounts.get(talent.id);
    
    switch (columnId) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className={wrapText ? "font-medium" : "truncate font-medium"}>{talent.name}</span>
            <DocsInlineIndicator 
              docCount={talentDocs?.totalCount || 0}
              hasPrimaryCV={talentDocs?.hasPrimaryCV || false}
              isLoading={docsLoading}
            />
          </div>
        );
      case "roleType":
        return (
          <span 
            className="text-sm line-clamp-2 break-words"
            style={{ 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '1.3',
              maxHeight: '2.6em'
            }}
          >
            {talent.roleType}
          </span>
        );
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
      case "docs":
        const docCount = documentCounts.get(talent.id);
        return (
          <DocsColumnCell
            talentId={talent.id}
            talentName={talent.name}
            docCount={docCount?.totalCount || 0}
            hasPrimaryCV={docCount?.hasPrimaryCV || false}
            isLoading={docsLoading}
          />
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

  // Get pinned columns for positioning calculations - maintain column order from visibleColumns
  const leftPinnedCols = useMemo(() => {
    return visibleColumns.filter(col => getLeftPinnedColumns(visibleColumns).includes(col.id)).map(c => c.id);
  }, [getLeftPinnedColumns, visibleColumns]);
  
  const rightPinnedCols = useMemo(() => {
    return visibleColumns.filter(col => getRightPinnedColumns(visibleColumns).includes(col.id)).map(c => c.id);
  }, [getRightPinnedColumns, visibleColumns]);

  // Get column width helper
  const getColumnWidth = (columnId: string): number => {
    return columnWidths[columnId] || visibleColumns.find(c => c.id === columnId)?.defaultWidth || 150;
  };

  // Checkbox column width (fixed)
  const CHECKBOX_COL_WIDTH = 50;

  // Calculate left offset for each left-pinned column
  // offset = checkbox width + sum of widths of all left-pinned columns before this one
  const leftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = CHECKBOX_COL_WIDTH;
    
    leftPinnedCols.forEach((colId) => {
      offsets[colId] = currentOffset;
      currentOffset += getColumnWidth(colId);
    });
    
    return offsets;
  }, [leftPinnedCols, columnWidths, visibleColumns]);

  // Calculate right offset for each right-pinned column
  // offset = sum of widths of all right-pinned columns after this one
  const rightOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let currentOffset = 0;
    
    // Process in reverse order (rightmost first gets offset 0)
    const reversed = [...rightPinnedCols].reverse();
    reversed.forEach((colId) => {
      offsets[colId] = currentOffset;
      currentOffset += getColumnWidth(colId);
    });
    
    return offsets;
  }, [rightPinnedCols, columnWidths, visibleColumns]);

  // Check if a column is the last left-pinned or first right-pinned (for shadow dividers)
  const isLastLeftPinned = useMemo(() => {
    if (leftPinnedCols.length === 0) return () => false;
    const lastId = leftPinnedCols[leftPinnedCols.length - 1];
    return (columnId: string) => columnId === lastId;
  }, [leftPinnedCols]);

  const isFirstRightPinned = useMemo(() => {
    if (rightPinnedCols.length === 0) return () => false;
    const firstId = rightPinnedCols[0];
    return (columnId: string) => columnId === firstId;
  }, [rightPinnedCols]);

  // Calculate total width of pinned areas for edge fade positioning
  const leftPinnedTotalWidth = useMemo(() => {
    if (leftPinnedCols.length === 0) return 0;
    return CHECKBOX_COL_WIDTH + leftPinnedCols.reduce((sum, colId) => sum + getColumnWidth(colId), 0);
  }, [leftPinnedCols, columnWidths, visibleColumns]);

  const rightPinnedTotalWidth = useMemo(() => {
    if (rightPinnedCols.length === 0) return 0;
    return rightPinnedCols.reduce((sum, colId) => sum + getColumnWidth(colId), 0);
  }, [rightPinnedCols, columnWidths, visibleColumns]);

  // Track horizontal scroll to show/hide edge fades
  const [hasScrolledRight, setHasScrolledRight] = useState(false);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    
    // Show left fade when scrolled right (content hidden on left)
    setHasScrolledRight(scrollLeft > 5);
    // Check if there's scrollable content
    setHasScrollableContent(scrollWidth > clientWidth + 10);
  }, []);

  // Check scrollable content on mount and resize
  useEffect(() => {
    const checkScrollable = () => {
      if (tableContainerRef.current) {
        const { scrollWidth, clientWidth } = tableContainerRef.current;
        setHasScrollableContent(scrollWidth > clientWidth + 10);
      }
    };
    
    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    const timeout = setTimeout(checkScrollable, 100);
    
    return () => {
      window.removeEventListener('resize', checkScrollable);
      clearTimeout(timeout);
    };
  }, [visibleColumns, columnWidths]);

  // Get cell styles based on view preferences and pinning
  // isHeader determines z-index stacking (headers above body cells)
  const getCellStyles = (columnId: string, isHeader: boolean = false, rowBackground?: string): React.CSSProperties => {
    const baseWidth = getColumnWidth(columnId);
    const pinPosition = isPinned(columnId);
    
    const baseStyles: React.CSSProperties = {
      minWidth: 0, // Allow flex children to shrink
    };
    
    if (viewPreferences.fitToScreen) {
      // Proportional widths with ellipsis
      baseStyles.width = "auto";
      baseStyles.minWidth = Math.min(baseWidth * 0.6, 100);
      baseStyles.maxWidth = viewPreferences.wrapText && wrappableColumns.has(columnId) ? undefined : baseWidth;
    } else {
      baseStyles.width = baseWidth;
      baseStyles.minWidth = baseWidth; // Enforce minimum to prevent shrinking
      baseStyles.maxWidth = viewPreferences.wrapText && wrappableColumns.has(columnId) ? undefined : baseWidth;
    }
    
    // Add sticky positioning for pinned columns
    if (pinPosition === "left") {
      return {
        ...baseStyles,
        zIndex: isHeader ? 30 : 20,
        background: isHeader ? "hsl(var(--muted))" : (rowBackground ?? "hsl(var(--card))"),
        backgroundClip: "padding-box",
        // Shadow divider on last left-pinned column
        boxShadow: isLastLeftPinned(columnId) 
          ? "4px 0 8px -4px hsl(var(--foreground) / 0.12)" 
          : undefined,
      };
    } else if (pinPosition === "right") {
      return {
        ...baseStyles,
        zIndex: isHeader ? 30 : 20,
        background: isHeader ? "hsl(var(--muted))" : (rowBackground ?? "hsl(var(--card))"),
        backgroundClip: "padding-box",
        // Shadow divider on first right-pinned column
        boxShadow: isFirstRightPinned(columnId) 
          ? "-4px 0 8px -4px hsl(var(--foreground) / 0.12)" 
          : undefined,
      };
    }
    
    // Non-pinned columns get lower z-index
    return {
      ...baseStyles,
      zIndex: isHeader ? 10 : 1,
    };
  };

  // Get checkbox column styles (always sticky left)
  const getCheckboxCellStyles = (isHeader: boolean = false, rowBackground?: string): React.CSSProperties => ({
    width: CHECKBOX_COL_WIDTH,
    minWidth: CHECKBOX_COL_WIDTH,
    width: CHECKBOX_COL_WIDTH,
    minWidth: CHECKBOX_COL_WIDTH,
    maxWidth: CHECKBOX_COL_WIDTH,
    zIndex: isHeader ? 31 : 21, // Slightly higher than other pinned cols
    background: isHeader ? "hsl(var(--muted))" : (rowBackground ?? "hsl(var(--card))"),
    backgroundClip: "padding-box",
  });

  return (
    <div className="bg-background">
      {/* Page Sub-header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Talent Database
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredTalents.length} candidates & contractors
                {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk action: Add to Outreach — visible only when rows are selected */}
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-sm border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => setShowAddToOutreach(true)}
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Add to Outreach…
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
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

              <ViewPresetsDropdown
                allPresets={allPresets}
                activePreset={activePreset}
                activePresetId={activePresetId}
                isModified={isCurrentViewModified(visibleColumns.map((c) => c.id))}
                onSelectPreset={selectPreset}
                onSavePreset={(name) => saveCustomPreset(name, visibleColumns.map((c) => c.id))}
                onDeletePreset={deleteCustomPreset}
                onUpdatePreset={(presetId) => updateCustomPreset(presetId, { columns: visibleColumns.map((c) => c.id) })}
              />

              <TalentColumnPicker
                columns={columns}
                onToggleColumn={toggleColumnVisibility}
                onToggleAll={setAllColumnsVisibility}
                isPinned={isPinned}
                canPin={canPin}
                onTogglePin={togglePin}
                open={columnPickerOpen}
                onOpenChange={setColumnPickerOpen}
              />

              {/* Responsive hidden columns indicator */}
              {responsiveHiddenCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setColumnPickerOpen(true)}
                >
                  <span className="hidden sm:inline">{responsiveHiddenCount} columns hidden</span>
                  <span className="sm:hidden">{responsiveHiddenCount} hidden</span>
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={!canInsert} data-jarvis-id="talent-import-button">
                          <Upload className="h-4 w-4 mr-2" />
                          Import
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setShowFastUpload(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Import CVs
                          <Badge variant="outline" className="ml-auto text-xs">Fast</Badge>
                        </DropdownMenuItem>
                        <Separator className="my-1" />
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
                        <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                          <Layers className="h-4 w-4 mr-2" />
                          Advanced Import
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => console.log("Import from LinkedIn")}>
                          <Linkedin className="h-4 w-4 mr-2" />
                          Import from LinkedIn
                        </DropdownMenuItem>
                        <Separator className="my-1" />
                        <DropdownMenuItem onClick={() => navigate("/imports")}>
                          <Clock className="h-4 w-4 mr-2" />
                          View Import History
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

              <Button variant="ghost" size="sm" onClick={() => navigate("/imports")} className="text-muted-foreground">
                <Clock className="h-4 w-4 mr-1.5" />
                History
              </Button>

              {/* Export button - only visible when Boolean search is active with results */}
              {booleanSearch.isBooleanMode && booleanSearch.hasResults && filteredTalents.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled
                        className="opacity-60 cursor-not-allowed"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export (CSV)
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-sm">Coming soon — Export matching candidates to CSV</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleAddTalent}
                      disabled={!canInsert}
                      data-jarvis-id="add-candidate-button"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      + Add Candidate
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

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-start gap-4 mb-4">
          <InlineSearchBar
            query={booleanSearch.query}
            onQueryChange={booleanSearch.setQuery}
            mode={booleanSearch.mode}
            onModeChange={booleanSearch.setMode}
            isValid={booleanSearch.isValidQuery}
            parseError={booleanSearch.parseError}
            isSearching={booleanSearch.isSearching}
            resultCount={booleanSearch.isBooleanMode ? booleanSearch.results.length : undefined}
            onClear={booleanSearch.clearSearch}
            onSubmit={booleanSearch.triggerSearch}
            placeholder="Search by name, skill, role, or email..."
            className="flex-1 min-w-[300px] max-w-2xl" data-jarvis-id="talent-search-input"
            includeCv={booleanSearch.includeCv}
            onIncludeCvChange={booleanSearch.setIncludeCv}
          />
          <div className="flex items-center gap-2 mt-1">
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger className="w-[160px]" data-jarvis-id="talent-filter-availability">
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
              <SelectTrigger className="w-[180px]" data-jarvis-id="talent-filter-role-type">
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
            
            {/* Toggle for search results view */}
            {booleanSearch.isBooleanMode && booleanSearch.hasResults && (
              <Toggle
                pressed={showSearchResults}
                onPressedChange={setShowSearchResults}
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                <LayoutList className="h-3.5 w-3.5" />
                Match Details
              </Toggle>
            )}
          </div>
        </div>

        {/* Boolean Search Results Panel - shows match highlights */}
        {booleanSearch.isBooleanMode && booleanSearch.hasResults && showSearchResults && (
          <div className="mb-4 border border-border rounded-lg bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Search Results ({booleanSearch.results.length} matches)
              </h3>
              <Badge variant="outline" className="text-xs">
                Ranked by relevance
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto">
              {booleanSearch.results.slice(0, 12).map((result) => (
                <SearchResultCard
                  key={result.candidate.id}
                  result={result}
                  onClick={() => navigate(`/talent/${result.candidate.id}`)}
                />
              ))}
            </div>
            {booleanSearch.results.length > 12 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Showing top 12 of {booleanSearch.results.length} results. Use filters to narrow down.
              </p>
            )}
          </div>
        )}

        {/* Table with Resizable Columns */}
        <div className="rounded-xl border border-border bg-card overflow-visible relative" style={{ borderLeft: '4px solid hsl(142 71% 45%)' }}>
          {/* Premium Edge Fade - Left Pinned Boundary */}
          <PinnedEdgeFade
            leftOffset={leftPinnedTotalWidth}
            visible={leftPinnedCols.length > 0 && (hasScrollableContent || hasScrolledRight)}
            width={20}
          />
          
          {/* Premium Edge Fade - Right Pinned Boundary */}
          <PinnedEdgeFadeRight
            rightOffset={rightPinnedTotalWidth}
            visible={rightPinnedCols.length > 0 && hasScrollableContent}
            width={20}
          />
          
          <ScrollableTableContainer 
            showScrollHint={isFirstVisit}
            maxHeight="calc(100vh - 320px)"
          >
            <Table style={{ minWidth: viewPreferences.fitToScreen ? undefined : `${totalTableWidth}px`, width: viewPreferences.fitToScreen ? '100%' : undefined }}>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead 
                    className="w-[50px] bg-muted"
                    style={getCheckboxCellStyles(true)}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className={isSomeSelected ? "opacity-50" : ""}
                    />
                  </TableHead>
                  {responsiveVisibleColumns.map((column) => {
                    const pinPosition = isPinned(column.id);
                    return (
                      <TableHead
                        key={column.id}
                        className={cn(
                          "font-semibold relative group",
                          viewPreferences.fitToScreen ? "" : "whitespace-nowrap",
                          // ALL header cells get solid background - critical for scroll overlap
                          "bg-muted"
                        )}
                        style={getCellStyles(column.id, true)}
                      >
                        <div className="flex items-center justify-between pr-2 min-w-0 overflow-hidden">
                          <span className="truncate">{column.label}</span>
                          {pinPosition && (
                            <span className="ml-1 text-primary/60 flex-shrink-0">
                              {pinPosition === "left" ? "◀" : "▶"}
                            </span>
                          )}
                        </div>
                        {/* Resize handle - hidden when fit to screen is active */}
                        {!viewPreferences.fitToScreen && (
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 bg-primary/50 hover:bg-primary transition-opacity"
                            onMouseDown={(e) => handleResizeStart(column.id, e)}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                  <TableHead className="font-semibold whitespace-nowrap bg-muted w-[120px]" style={{ zIndex: 10 }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTalents.map((talent, index) => {
                  // Get search result for this talent (if in Boolean mode)
                  const searchResult = booleanSearch.isBooleanMode && booleanSearch.hasResults
                    ? booleanSearch.results.find(r => r.candidate.id === talent.id)
                    : undefined;
                    
                  const rowBg = index % 2 === 1
                    ? "rgba(255,255,255,0.03)"
                    : "hsl(var(--card))";
                  return (
                    <TableRow
                      key={talent.id}
                      style={{ background: rowBg }}
                      className="cursor-pointer transition-colors group/row hover:bg-muted/30"
                      onClick={() => handleRowClick(talent)}
                    >
                      <TableCell 
                        onClick={(e) => e.stopPropagation()} 
                        className="relative"
                        style={getCheckboxCellStyles(false, rowBg)}
                      >
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
                      {responsiveVisibleColumns.map((column) => {
                        const pinPosition = isPinned(column.id);
                        return (
                          <TableCell
                            key={column.id}
                            className={cn(
                              "overflow-hidden text-ellipsis",
                              viewPreferences.wrapText && wrappableColumns.has(column.id)
                                ? "whitespace-normal"
                                : "whitespace-nowrap",
                              // Pinned cells override with slightly different styling on hover
                              pinPosition && "group-hover/row:bg-muted/50"
                            )}
                            style={getCellStyles(column.id, false, rowBg)}
                          >
                            <div className="min-w-0 overflow-hidden text-ellipsis">
                              {renderCellContent(column.id, talent, viewPreferences.wrapText)}
                              {/* Match indicator badge for name column in Boolean mode */}
                              {column.id === "name" && searchResult && (
                                <div className="flex items-center gap-1 mt-1">
                                  <MatchIndicatorBadge 
                                    matchedIn={searchResult.matchedIn}
                                    matchScore={searchResult.matchScore}
                                    matchQuality={searchResult.matchQuality}
                                    matchBreakdown={searchResult.matchBreakdown}
                                    matchedTerms={searchResult.highlights.matchedTerms}
                                    highlightSnippets={{
                                      headline: searchResult.highlights.headline,
                                      cvSnippet: searchResult.highlights.cvSnippet,
                                    }}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSnippetsPanelResult(searchResult);
                                    }}
                                  >
                                    <Eye className="h-3 w-3 mr-0.5" />
                                    Matches
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell style={{ zIndex: 1 }}>
                        <RowInlineActions
                          className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
                          workspaceId={currentWorkspace?.id || ""}
                          entityName={talent.name}
                          entityEmail={talent.email}
                          entityPhone={talent.phone}
                          entityTitle={talent.roleType}
                          candidateId={talent.id}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
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
            {candidatesLoading ? "Loading..." : `Showing ${filteredTalents.length} of ${allTalents.length} candidates`}
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
        onSkillFilter={(skill) => booleanSearch.setQuery(skill)}
        onViewCV={() => setShowCVViewer(true)}
      />

      {/* CV Viewer */}
      <CVViewer
        talent={selectedTalent}
        open={showCVViewer}
        onClose={() => setShowCVViewer(false)}
        onBack={() => setShowCVViewer(false)}
      />

      {/* Fast CV Upload */}
      <FastCVUpload
        open={showFastUpload}
        onOpenChange={setShowFastUpload}
        onComplete={() => {
          invalidateCandidates();
          refetchCandidates();
        }}
      />

      {/* Smart Import Modal (AI-based import for CVs, images, etc.) */}
      <SmartImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        context={{
          source: 'TALENT',
        }}
        onComplete={() => {
          // Refresh talent list after import completes
          console.log("[TalentDatabase] Import complete, invalidating candidates cache");
          invalidateCandidates();
          refetchCandidates();
        }}
      />

      {/* Bulk CSV/XLSX/OCR Import Modal - Shared Component */}
      <ImportCenterModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        entityType="talent"
        initialMethod={bulkImportMethod}
        onImportComplete={(records) => {
          // Add imported candidates to mock data (in real app, would save to DB)
          console.log("[TalentDatabase] Bulk import complete:", records.length, "records");
          // Refresh the list
          invalidateCandidates();
          refetchCandidates();
        }}
      />

      {/* Match Snippets Panel */}
      <MatchSnippetsPanel
        open={!!snippetsPanelResult}
        onClose={() => setSnippetsPanelResult(null)}
        result={snippetsPanelResult}
        candidateName={snippetsPanelResult?.candidate.name || ""}
      />

      {/* Add to Outreach bulk action modal */}
      <AddToOutreachModal
        open={showAddToOutreach}
        onOpenChange={(v) => {
          setShowAddToOutreach(v);
          if (!v) setSelectedIds(new Set());
        }}
        candidates={filteredTalents.filter((t) => selectedIds.has(t.id))}
        defaultCampaignId={returnToCampaignId}
      />

      {/* Add Candidate Modal */}
      <AddCandidateModal
        open={showAddCandidate}
        onOpenChange={setShowAddCandidate}
        onSuccess={() => {
          invalidateCandidates();
          refetchCandidates();
        }}
      />
    </div>
  );
}
