import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FlexibleCombobox } from "@/components/canvas/FlexibleCombobox";
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import { cn } from "@/lib/utils";
import { departmentOptions, jobTitleOptionsFlat } from "@/lib/dropdown-options";
import { applySmartDepartments, inferDepartmentFromTitle } from "@/lib/department-inference";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  GitMerge,
  Lightbulb,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type { OrgChartRow, DuplicateAction } from "../OrgChartBuilderModal";

interface OrgChartReviewStepProps {
  extractedRows: OrgChartRow[];
  onExtractedRowsChange: (rows: OrgChartRow[]) => void;
}

// Validation function
function validateRow(row: OrgChartRow): string[] {
  const errors: string[] = [];
  if (!row.full_name.trim()) {
    errors.push("Name is required");
  }
  if (!row.job_title.trim()) {
    errors.push("Job Title is required");
  }
  if (!row.department.trim()) {
    errors.push("Department is required");
  }
  return errors;
}

type ViewMode = "table" | "grouped";
type GroupByMode = "department" | "suggestion" | "title_cluster";
type BulkApplyScope = "selected" | "all";

// Title cluster patterns for grouping
const TITLE_CLUSTER_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  { name: "Executive / C-Suite", patterns: [/^(ceo|coo|cfo|cto|cio|ciso|cdo|cro|cco|chro)$/i, /chief.*officer/i, /president/i, /founder/i] },
  { name: "Head / VP", patterns: [/^head\s/i, /\shead$/i, /head\sof/i, /^vp\s/i, /vice\s*president/i, /svp/i] },
  { name: "Director", patterns: [/director/i, /managing\s*director/i] },
  { name: "Manager", patterns: [/manager/i, /lead$/i, /team\s*lead/i] },
  { name: "Individual Contributor", patterns: [/.*/] }, // Catch-all
];

function getTitleCluster(jobTitle: string): string {
  if (!jobTitle.trim()) return "Unknown";
  const normalized = jobTitle.trim().toLowerCase();
  for (const cluster of TITLE_CLUSTER_PATTERNS) {
    // Skip the catch-all for matching
    if (cluster.name === "Individual Contributor") continue;
    for (const pattern of cluster.patterns) {
      if (pattern.test(normalized)) {
        return cluster.name;
      }
    }
  }
  return "Individual Contributor";
}

// Status options for contacts
const STATUS_OPTIONS = [
  { value: "warm", label: "Warm" },
  { value: "engaged", label: "Engaged" },
  { value: "cold", label: "Cold" },
  { value: "new", label: "New" },
  { value: "champion", label: "Champion" },
  { value: "blocker", label: "Blocker" },
];

// Common location options
const LOCATION_OPTIONS = [
  "London, UK",
  "New York, USA",
  "Singapore",
  "Hong Kong",
  "Tokyo, Japan",
  "Sydney, Australia",
  "Frankfurt, Germany",
  "Paris, France",
  "Remote",
];

export function OrgChartReviewStep({
  extractedRows,
  onExtractedRowsChange,
}: OrgChartReviewStepProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [groupByMode, setGroupByMode] = useState<GroupByMode>("suggestion");
  
  // Bulk apply state
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkApplyScope, setBulkApplyScope] = useState<BulkApplyScope>("selected");
  
  // Filter state
  const [titleFilter, setTitleFilter] = useState("");
  const [showFilterPopover, setShowFilterPopover] = useState(false);

  // Run validation whenever rows change
  useEffect(() => {
    const needsUpdate = extractedRows.some((row) => {
      const currentErrors = validateRow(row);
      return JSON.stringify(currentErrors) !== JSON.stringify(row.validationErrors);
    });

    if (needsUpdate) {
      onExtractedRowsChange(
        extractedRows.map((row) => ({
          ...row,
          validationErrors: validateRow(row),
        }))
      );
    }
  }, [extractedRows, onExtractedRowsChange]);

  // Computed stats
  const selectedCount = extractedRows.filter((r) => r.selected).length;
  const lowConfidenceCount = extractedRows.filter((r) => r.confidence === "low").length;
  const duplicateCount = extractedRows.filter((r) => r.isDuplicate).length;
  const errorCount = extractedRows.filter(
    (r) => r.selected && r.validationErrors.length > 0
  ).length;
  const unhandledDuplicates = extractedRows.filter(
    (r) => r.selected && r.isDuplicate && r.duplicateAction === null
  ).length;
  
  // Missing field counts
  const missingDepartmentCount = extractedRows.filter(
    (r) => !r.department.trim()
  ).length;
  const missingNameCount = extractedRows.filter(
    (r) => !r.full_name.trim()
  ).length;
  const missingTitleCount = extractedRows.filter(
    (r) => !r.job_title.trim()
  ).length;
  
  // Selected rows missing required fields (blocked from import)
  const selectedMissingDeptCount = extractedRows.filter(
    (r) => r.selected && !r.department.trim()
  ).length;
  const selectedMissingNameCount = extractedRows.filter(
    (r) => r.selected && !r.full_name.trim()
  ).length;
  const selectedMissingTitleCount = extractedRows.filter(
    (r) => r.selected && !r.job_title.trim()
  ).length;
  
  // Count rows that are ready to import (selected + valid)
  const readyToImportCount = extractedRows.filter(
    (r) => r.selected && r.validationErrors.length === 0 && (!r.isDuplicate || r.duplicateAction !== null)
  ).length;

  // Compute suggested departments for all rows
  const rowsWithSuggestions = useMemo(() => {
    return extractedRows.map((row) => ({
      ...row,
      suggestedDepartment: !row.department.trim() && row.job_title.trim()
        ? inferDepartmentFromTitle(row.job_title)
        : null,
    }));
  }, [extractedRows]);

  // Count how many have suggestions available
  const suggestionsCount = rowsWithSuggestions.filter((r) => r.suggestedDepartment).length;
  const selectedSuggestionsCount = rowsWithSuggestions.filter(
    (r) => r.selected && r.suggestedDepartment
  ).length;

  // Count how many can be auto-inferred (alias for backwards compat)
  const autoInferableCount = suggestionsCount;

  // Filter matching counts
  const titleMatchCount = titleFilter.trim()
    ? extractedRows.filter((r) => r.job_title.toLowerCase().includes(titleFilter.toLowerCase())).length
    : 0;
  const emptyDeptCount = missingDepartmentCount;
  const lowConfCount = lowConfidenceCount;
  
  // Default department for quick fill
  const [defaultDepartment, setDefaultDepartment] = useState("");

  // Group rows by department for grouped view
  const groupedByDepartment = useMemo(() => {
    const groups: Record<string, OrgChartRow[]> = {};
    const uncategorized: OrgChartRow[] = [];

    extractedRows.forEach((row) => {
      if (row.department.trim()) {
        if (!groups[row.department]) {
          groups[row.department] = [];
        }
        groups[row.department].push(row);
      } else {
        uncategorized.push(row);
      }
    });

    return { groups, uncategorized };
  }, [extractedRows]);

  // Group rows by suggested department
  const groupedBySuggestion = useMemo(() => {
    const groups: Record<string, { rows: OrgChartRow[]; suggestedDept: string }> = {};
    const alreadyAssigned: OrgChartRow[] = [];
    const noSuggestion: OrgChartRow[] = [];

    extractedRows.forEach((row) => {
      // If already has department, group separately
      if (row.department.trim()) {
        alreadyAssigned.push(row);
        return;
      }

      // Get suggestion for this row
      const suggestion = row.job_title.trim() ? inferDepartmentFromTitle(row.job_title) : null;
      if (suggestion) {
        const key = `suggested:${suggestion}`;
        if (!groups[key]) {
          groups[key] = { rows: [], suggestedDept: suggestion };
        }
        groups[key].rows.push(row);
      } else {
        noSuggestion.push(row);
      }
    });

    return { groups, alreadyAssigned, noSuggestion };
  }, [extractedRows]);

  // Group rows by title cluster (Executive, Head/VP, Director, Manager, IC)
  const groupedByTitleCluster = useMemo(() => {
    const groups: Record<string, OrgChartRow[]> = {};

    extractedRows.forEach((row) => {
      const cluster = getTitleCluster(row.job_title);
      if (!groups[cluster]) {
        groups[cluster] = [];
      }
      groups[cluster].push(row);
    });

    // Sort by hierarchy order
    const orderedGroups: Record<string, OrgChartRow[]> = {};
    const clusterOrder = ["Executive / C-Suite", "Head / VP", "Director", "Manager", "Individual Contributor", "Unknown"];
    clusterOrder.forEach((name) => {
      if (groups[name]?.length > 0) {
        orderedGroups[name] = groups[name];
      }
    });

    return orderedGroups;
  }, [extractedRows]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    onExtractedRowsChange(
      extractedRows.map((row) => ({ ...row, selected: checked }))
    );
    toast({
      title: checked ? "Selected all rows" : "Deselected all rows",
      description: `${extractedRows.length} rows ${checked ? "selected" : "deselected"}`,
    });
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.id === id ? { ...row, selected: checked } : row
      )
    );
  };

  const handleEditField = (
    id: string,
    field: keyof OrgChartRow,
    value: string
  ) => {
    onExtractedRowsChange(
      extractedRows.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
  };

  const handleDuplicateAction = (id: string, action: DuplicateAction) => {
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.id === id ? { ...row, duplicateAction: action } : row
      )
    );
  };

  // Filter-based selection handlers
  const handleSelectByTitleFilter = () => {
    if (!titleFilter.trim()) return;
    const matchingIds = extractedRows
      .filter((r) => r.job_title.toLowerCase().includes(titleFilter.toLowerCase()))
      .map((r) => r.id);
    
    onExtractedRowsChange(
      extractedRows.map((row) =>
        matchingIds.includes(row.id) ? { ...row, selected: true } : row
      )
    );
    toast({
      title: "Applied filter selection",
      description: `Selected ${matchingIds.length} rows matching "${titleFilter}"`,
    });
    setShowFilterPopover(false);
  };

  const handleSelectEmptyDept = () => {
    const matchingIds = extractedRows
      .filter((r) => !r.department.trim())
      .map((r) => r.id);
    
    onExtractedRowsChange(
      extractedRows.map((row) =>
        matchingIds.includes(row.id) ? { ...row, selected: true } : row
      )
    );
    toast({
      title: "Selected empty department rows",
      description: `Selected ${matchingIds.length} rows with empty department`,
    });
    setShowFilterPopover(false);
  };

  const handleSelectLowConfidence = () => {
    const matchingIds = extractedRows
      .filter((r) => r.confidence === "low")
      .map((r) => r.id);
    
    onExtractedRowsChange(
      extractedRows.map((row) =>
        matchingIds.includes(row.id) ? { ...row, selected: true } : row
      )
    );
    toast({
      title: "Selected low confidence rows",
      description: `Selected ${matchingIds.length} rows with low confidence`,
    });
    setShowFilterPopover(false);
  };

  const handleDeselectLowConfidence = () => {
    const count = extractedRows.filter((r) => r.confidence === "low").length;
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.confidence === "low" ? { ...row, selected: false } : row
      )
    );
    toast({
      title: "Deselected low confidence rows",
      description: `Deselected ${count} rows`,
    });
  };

  const handleDeselectDuplicates = () => {
    const count = extractedRows.filter((r) => r.isDuplicate).length;
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.isDuplicate ? { ...row, selected: false } : row
      )
    );
    toast({
      title: "Deselected duplicate rows",
      description: `Deselected ${count} rows`,
    });
  };

  const handleDeselectInvalid = () => {
    const count = extractedRows.filter((r) => r.validationErrors.length > 0).length;
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.validationErrors.length > 0 ? { ...row, selected: false } : row
      )
    );
    toast({
      title: "Deselected invalid rows",
      description: `Deselected ${count} rows with validation errors`,
    });
  };

  // Bulk apply handlers with scope
  const getTargetRows = () => {
    if (bulkApplyScope === "all") {
      return extractedRows;
    }
    return extractedRows.filter((r) => r.selected);
  };

  const handleBulkApplyDepartment = () => {
    if (!bulkDepartment.trim()) return;
    const targetRows = getTargetRows();
    const count = targetRows.length;
    
    onExtractedRowsChange(
      extractedRows.map((row) => {
        const isTarget = bulkApplyScope === "all" || row.selected;
        if (!isTarget) return row;
        const updated = { ...row, department: bulkDepartment };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
    setBulkDepartment("");
    toast({
      title: "Department applied",
      description: `Applied to ${count} rows`,
    });
  };

  const handleBulkApplyLocation = () => {
    if (!bulkLocation.trim()) return;
    const targetRows = getTargetRows();
    const count = targetRows.length;
    
    onExtractedRowsChange(
      extractedRows.map((row) => {
        const isTarget = bulkApplyScope === "all" || row.selected;
        if (!isTarget) return row;
        return { ...row, location: bulkLocation };
      })
    );
    setBulkLocation("");
    toast({
      title: "Location applied",
      description: `Applied to ${count} rows`,
    });
  };

  const handleBulkApplyStatus = () => {
    if (!bulkStatus.trim()) return;
    const targetRows = getTargetRows();
    const count = targetRows.length;
    
    onExtractedRowsChange(
      extractedRows.map((row) => {
        const isTarget = bulkApplyScope === "all" || row.selected;
        if (!isTarget) return row;
        return { ...row, status: bulkStatus };
      })
    );
    setBulkStatus("");
    toast({
      title: "Status applied",
      description: `Applied to ${count} rows`,
    });
  };

  // Smart auto-fill department - accept all suggestions
  const handleAcceptAllSuggestions = () => {
    let acceptedCount = 0;
    const updatedRows = extractedRows.map((row) => {
      const suggestion = !row.department.trim() && row.job_title.trim()
        ? inferDepartmentFromTitle(row.job_title)
        : null;
      if (suggestion) {
        acceptedCount++;
        const updated = { ...row, department: suggestion };
        updated.validationErrors = validateRow(updated);
        return updated;
      }
      return row;
    });
    
    if (acceptedCount > 0) {
      onExtractedRowsChange(updatedRows);
      toast({
        title: "Accepted all suggested departments",
        description: `Applied to ${acceptedCount} rows based on job titles`,
      });
    }
  };

  // Accept suggestions for selected rows only
  const handleAcceptSelectedSuggestions = () => {
    let acceptedCount = 0;
    const updatedRows = extractedRows.map((row) => {
      if (!row.selected) return row;
      const suggestion = !row.department.trim() && row.job_title.trim()
        ? inferDepartmentFromTitle(row.job_title)
        : null;
      if (suggestion) {
        acceptedCount++;
        const updated = { ...row, department: suggestion };
        updated.validationErrors = validateRow(updated);
        return updated;
      }
      return row;
    });
    
    if (acceptedCount > 0) {
      onExtractedRowsChange(updatedRows);
      toast({
        title: "Accepted suggested departments",
        description: `Applied to ${acceptedCount} selected rows`,
      });
    }
  };

  // Apply department to all rows in a group
  const handleApplyDepartmentToGroup = (groupDept: string, newDept: string) => {
    const count = extractedRows.filter((r) => r.department === groupDept).length;
    onExtractedRowsChange(
      extractedRows.map((row) => {
        if (row.department !== groupDept) return row;
        const updated = { ...row, department: newDept };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
    toast({
      title: "Department updated",
      description: `Applied to ${count} rows in group`,
    });
  };

  const allSelected = extractedRows.every((r) => r.selected);
  const someSelected = extractedRows.some((r) => r.selected) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Data Quality Gate - Top Banner */}
      {errorCount > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/20 shrink-0">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h4 className="font-semibold text-destructive flex items-center gap-2">
                  {errorCount} {errorCount === 1 ? "row" : "rows"} cannot be imported
                </h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Selected rows must have Name, Job Title, and Department filled before import.
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  {selectedMissingNameCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      {selectedMissingNameCount} missing Name
                    </span>
                  )}
                  {selectedMissingTitleCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      {selectedMissingTitleCount} missing Job Title
                    </span>
                  )}
                  {selectedMissingDeptCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      {selectedMissingDeptCount} missing Department
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Fix Actions */}
            {selectedMissingDeptCount > 0 && (
              <div className="flex flex-col gap-2 shrink-0">
                {/* Fill with suggestions */}
                {selectedSuggestionsCount > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleAcceptSelectedSuggestions}
                    className="gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Fill {selectedSuggestionsCount} with Suggestions
                  </Button>
                )}
                {/* Fill with default department */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Wand2 className="h-3.5 w-3.5" />
                      Assign Default Department
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 bg-popover border shadow-lg z-50" align="end">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Set a default department for {selectedMissingDeptCount} selected rows missing departments
                      </p>
                      <FlexibleCombobox
                        value={defaultDepartment}
                        onChange={setDefaultDepartment}
                        options={departmentOptions}
                        placeholder="Select department..."
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            if (!defaultDepartment.trim()) return;
                            let filled = 0;
                            onExtractedRowsChange(
                              extractedRows.map((row) => {
                                if (row.selected && !row.department.trim()) {
                                  filled++;
                                  const updated = { ...row, department: defaultDepartment };
                                  updated.validationErrors = validateRow(updated);
                                  return updated;
                                }
                                return row;
                              })
                            );
                            toast({
                              title: "Default department applied",
                              description: `Applied "${defaultDepartment}" to ${filled} rows`,
                            });
                            setDefaultDepartment("");
                          }}
                          disabled={!defaultDepartment.trim()}
                          className="flex-1"
                        >
                          Apply to Selected
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Summary Badges & View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant={errorCount === 0 ? "default" : "outline"} 
            className={cn(
              "py-1.5",
              errorCount === 0 && readyToImportCount > 0 && "bg-primary"
            )}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {readyToImportCount} ready to import
          </Badge>
          <Badge variant="outline" className="py-1.5">
            {selectedCount} / {extractedRows.length} selected
          </Badge>
          {unhandledDuplicates > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning-foreground py-1.5">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {unhandledDuplicates} duplicates need action
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">View:</span>
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-7 px-3 text-xs"
            >
              Flat List
            </Button>
            <Button
              variant={viewMode === "grouped" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className="h-7 px-3 text-xs"
            >
              Grouped
            </Button>
          </div>
          
          {viewMode === "grouped" && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Group by:</span>
              <Select value={groupByMode} onValueChange={(v) => setGroupByMode(v as GroupByMode)}>
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="suggestion">Department Suggestion</SelectItem>
                  <SelectItem value="title_cluster">Title Level</SelectItem>
                  <SelectItem value="department">Existing Department</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* Smart Auto-fill Banner - only show when no errors exist */}
      {suggestionsCount > 0 && errorCount === 0 && (
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <span className="font-medium">{suggestionsCount} rows</span> have suggested departments based on job title
              {selectedSuggestionsCount > 0 && selectedSuggestionsCount < suggestionsCount && (
                <span className="text-muted-foreground"> ({selectedSuggestionsCount} selected)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedSuggestionsCount > 0 && selectedSuggestionsCount < suggestionsCount && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleAcceptSelectedSuggestions} 
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Accept Selected ({selectedSuggestionsCount})
              </Button>
            )}
            <Button size="sm" onClick={handleAcceptAllSuggestions} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Accept All Suggestions
            </Button>
          </div>
        </div>
      )}
      
      {/* Also show auto-fill banner when there ARE errors and suggestions can help */}
      {suggestionsCount > 0 && errorCount > 0 && selectedSuggestionsCount !== selectedMissingDeptCount && (
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <span className="font-medium">{suggestionsCount - selectedSuggestionsCount} more rows</span> have department suggestions available
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleAcceptAllSuggestions} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Accept All Suggestions
          </Button>
        </div>
      )}

      {/* Row Selection Tools */}
      <div className="flex items-center justify-between gap-3 bg-muted/30 border rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = someSelected;
                }
              }}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </label>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          {/* Filter Selection Popover */}
          <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filter & Select
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-popover border shadow-lg z-50" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title contains</label>
                  <div className="flex gap-2">
                    <Input
                      value={titleFilter}
                      onChange={(e) => setTitleFilter(e.target.value)}
                      placeholder="e.g. Engineer, Manager..."
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={handleSelectByTitleFilter}
                      disabled={!titleFilter.trim()}
                      className="h-8"
                    >
                      <CheckSquare className="h-3.5 w-3.5 mr-1" />
                      Select ({titleMatchCount})
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quick filters</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectEmptyDept}
                      disabled={emptyDeptCount === 0}
                      className="h-7 text-xs"
                    >
                      Empty Department ({emptyDeptCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectLowConfidence}
                      disabled={lowConfCount === 0}
                      className="h-7 text-xs"
                    >
                      Low Confidence ({lowConfCount})
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick Deselect Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {errorCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDeselectInvalid} className="h-7 text-xs">
              Deselect Invalid ({errorCount})
            </Button>
          )}
          {lowConfidenceCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDeselectLowConfidence} className="h-7 text-xs">
              Deselect Low Conf. ({lowConfidenceCount})
            </Button>
          )}
          {duplicateCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDeselectDuplicates} className="h-7 text-xs">
              Deselect Duplicates ({duplicateCount})
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Bulk Apply Bar */}
      <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Bulk Apply</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Apply to:</span>
            <Select value={bulkApplyScope} onValueChange={(v) => setBulkApplyScope(v as BulkApplyScope)}>
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                <SelectItem value="selected">Selected ({selectedCount})</SelectItem>
                <SelectItem value="all">All rows ({extractedRows.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Bulk Department */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Department</label>
            <div className="flex gap-2">
              <FlexibleCombobox
                value={bulkDepartment}
                onChange={setBulkDepartment}
                options={departmentOptions}
                placeholder="Select department..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleBulkApplyDepartment}
                disabled={!bulkDepartment.trim() || (bulkApplyScope === "selected" && selectedCount === 0)}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Bulk Location */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Location</label>
            <div className="flex gap-2">
              <FlexibleCombobox
                value={bulkLocation}
                onChange={setBulkLocation}
                options={LOCATION_OPTIONS}
                placeholder="Select location..."
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleBulkApplyLocation}
                disabled={!bulkLocation.trim() || (bulkApplyScope === "selected" && selectedCount === 0)}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Bulk Status */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Status</label>
            <div className="flex gap-2">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkApplyStatus}
                disabled={!bulkStatus.trim() || (bulkApplyScope === "selected" && selectedCount === 0)}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
        <span className="font-medium">Required fields:</span>
        <span>Name *</span>
        <span>Job Title *</span>
        <span>Department *</span>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="border rounded-lg">
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] sticky left-0 bg-background z-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as any).indeterminate = someSelected;
                        }
                      }}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[140px]">Name *</TableHead>
                  <TableHead className="w-[160px]">Job Title *</TableHead>
                  <TableHead className="w-[150px]">Department *</TableHead>
                  <TableHead className="w-[100px]">Location</TableHead>
                  <TableHead className="w-[140px]">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </div>
                  </TableHead>
                  <TableHead className="w-[70px]">Conf.</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedRows.map((row) => (
                  <ReviewTableRow
                    key={row.id}
                    row={row}
                    onSelect={handleSelectRow}
                    onEditField={handleEditField}
                    onDuplicateAction={handleDuplicateAction}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {/* Grouped View */}
      {viewMode === "grouped" && (
        <div className="space-y-3">
          {/* Group by Suggestion Mode */}
          {groupByMode === "suggestion" && (
            <>
              {/* Groups with suggestions */}
              {Object.entries(groupedBySuggestion.groups).map(([key, { rows, suggestedDept }]) => (
                <SuggestionGroup
                  key={key}
                  suggestedDepartment={suggestedDept}
                  rows={rows}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                  onApplyToAll={() => {
                    rows.forEach((row) => handleEditField(row.id, "department", suggestedDept));
                    toast({
                      title: "Department applied",
                      description: `Applied "${suggestedDept}" to ${rows.length} rows`,
                    });
                  }}
                />
              ))}
              {/* Already assigned */}
              {groupedBySuggestion.alreadyAssigned.length > 0 && (
                <DepartmentGroup
                  department={`Already Assigned (${groupedBySuggestion.alreadyAssigned.length})`}
                  rows={groupedBySuggestion.alreadyAssigned}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                />
              )}
              {/* No suggestion available */}
              {groupedBySuggestion.noSuggestion.length > 0 && (
                <DepartmentGroup
                  department="No Suggestion Available"
                  rows={groupedBySuggestion.noSuggestion}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                  isUncategorized
                />
              )}
            </>
          )}

          {/* Group by Title Cluster Mode */}
          {groupByMode === "title_cluster" && (
            <>
              {Object.entries(groupedByTitleCluster).map(([cluster, rows]) => (
                <TitleClusterGroup
                  key={cluster}
                  cluster={cluster}
                  rows={rows}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                />
              ))}
            </>
          )}

          {/* Group by Existing Department Mode */}
          {groupByMode === "department" && (
            <>
              {Object.entries(groupedByDepartment.groups).map(([dept, rows]) => (
                <DepartmentGroup
                  key={dept}
                  department={dept}
                  rows={rows}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                  onApplyDepartmentToAll={(newDept) => handleApplyDepartmentToGroup(dept, newDept)}
                />
              ))}
              {groupedByDepartment.uncategorized.length > 0 && (
                <DepartmentGroup
                  department="Uncategorized"
                  rows={groupedByDepartment.uncategorized}
                  onSelectRow={handleSelectRow}
                  onEditField={handleEditField}
                  onDuplicateAction={handleDuplicateAction}
                  isUncategorized
                />
              )}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Click any cell to edit. Use bulk apply to set values for multiple rows at once.
      </p>
    </div>
  );
}

// Individual table row component
function ReviewTableRow({
  row,
  onSelect,
  onEditField,
  onDuplicateAction,
}: {
  row: OrgChartRow;
  onSelect: (id: string, checked: boolean) => void;
  onEditField: (id: string, field: keyof OrgChartRow, value: string) => void;
  onDuplicateAction: (id: string, action: DuplicateAction) => void;
}) {
  const hasErrors = row.validationErrors.length > 0;
  const suggestedDept = !row.department.trim() && row.job_title.trim()
    ? inferDepartmentFromTitle(row.job_title)
    : null;

  return (
    <TableRow
      className={cn(
        !row.selected && "opacity-50 bg-muted/30",
        row.selected && hasErrors && "bg-destructive/5",
        row.selected && row.isDuplicate && !hasErrors && "bg-warning/5"
      )}
    >
      <TableCell className="sticky left-0 bg-background z-10">
        <Checkbox
          checked={row.selected}
          onCheckedChange={(checked) => onSelect(row.id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={row.full_name}
          onChange={(val) => onEditField(row.id, "full_name", val)}
          hasError={row.selected && !row.full_name.trim()}
          placeholder="Enter name"
        />
      </TableCell>
      <TableCell>
        <FlexibleCombobox
          value={row.job_title}
          onChange={(val) => onEditField(row.id, "job_title", val)}
          options={jobTitleOptionsFlat}
          placeholder="Select or type..."
          className={cn(
            row.selected && !row.job_title.trim() && "ring-2 ring-destructive/50 rounded-md"
          )}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          {row.department.trim() ? (
            <FlexibleCombobox
              value={row.department}
              onChange={(val) => onEditField(row.id, "department", val)}
              options={departmentOptions}
              placeholder="Select or type..."
            />
          ) : (
            <>
              <FlexibleCombobox
                value={row.department}
                onChange={(val) => onEditField(row.id, "department", val)}
                options={departmentOptions}
                placeholder="Select or type..."
                className={cn(
                  row.selected && "ring-2 ring-destructive/50 rounded-md"
                )}
              />
              {suggestedDept && (
                <button
                  type="button"
                  onClick={() => onEditField(row.id, "department", suggestedDept)}
                  className="flex items-center gap-1.5 w-full px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded text-primary transition-colors"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">Suggested: <span className="font-medium">{suggestedDept}</span></span>
                  <Check className="h-3 w-3 ml-auto shrink-0" />
                </button>
              )}
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={row.location}
          onChange={(val) => onEditField(row.id, "location", val)}
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <EditableTextCell
            value={row.email || ""}
            onChange={(val) => onEditField(row.id, "email", val)}
            placeholder="—"
          />
          {row.email && row.emailConfidence === "low" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Low confidence - please verify</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <EditableTextCell
              value={row.phone || ""}
              onChange={(val) => onEditField(row.id, "phone", val)}
              placeholder="—"
            />
            {row.phones?.some(p => p.confidence === "low") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Low confidence - please verify</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Show additional phones if more than 1 */}
          {row.phones && row.phones.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {row.phones.slice(1).map((p, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 h-4 capitalize"
                >
                  {p.type}: {p.number.slice(-6)}
                  {p.confidence === "low" && (
                    <AlertTriangle className="h-2.5 w-2.5 ml-0.5 text-warning" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <ConfidenceBadge confidence={row.confidence} />
      </TableCell>
      <TableCell>
        <RowStatusCell
          row={row}
          onDuplicateAction={(action) => onDuplicateAction(row.id, action)}
        />
      </TableCell>
    </TableRow>
  );
}

// Department group for grouped view
function DepartmentGroup({
  department,
  rows,
  onSelectRow,
  onEditField,
  onDuplicateAction,
  onApplyDepartmentToAll,
  isUncategorized = false,
}: {
  department: string;
  rows: OrgChartRow[];
  onSelectRow: (id: string, checked: boolean) => void;
  onEditField: (id: string, field: keyof OrgChartRow, value: string) => void;
  onDuplicateAction: (id: string, action: DuplicateAction) => void;
  onApplyDepartmentToAll?: (newDept: string) => void;
  isUncategorized?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [bulkDept, setBulkDept] = useState("");
  const selectedCount = rows.filter((r) => r.selected).length;
  const errorCount = rows.filter((r) => r.selected && r.validationErrors.length > 0).length;

  const handleSelectAll = (checked: boolean) => {
    rows.forEach((row) => onSelectRow(row.id, checked));
  };

  const allSelected = rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected) && !allSelected;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
              />
              <span className={cn(
                "font-medium text-sm",
                isUncategorized && "text-muted-foreground italic"
              )}>
                {department}
              </span>
              <Badge variant="secondary" className="text-xs">
                {selectedCount}/{rows.length}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {errorCount} errors
                </Badge>
              )}
            </div>
            {isUncategorized && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <FlexibleCombobox
                  value={bulkDept}
                  onChange={setBulkDept}
                  options={departmentOptions}
                  placeholder="Set department..."
                  className="w-[160px]"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (bulkDept.trim()) {
                      rows.forEach((row) => onEditField(row.id, "department", bulkDept));
                      setBulkDept("");
                    }
                  }}
                  disabled={!bulkDept.trim()}
                >
                  Apply All
                </Button>
              </div>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-[250px]">
            <Table>
              <TableBody>
                {rows.map((row) => (
                  <ReviewTableRow
                    key={row.id}
                    row={row}
                    onSelect={onSelectRow}
                    onEditField={onEditField}
                    onDuplicateAction={onDuplicateAction}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Suggestion group for grouped by suggestion view
function SuggestionGroup({
  suggestedDepartment,
  rows,
  onSelectRow,
  onEditField,
  onDuplicateAction,
  onApplyToAll,
}: {
  suggestedDepartment: string;
  rows: OrgChartRow[];
  onSelectRow: (id: string, checked: boolean) => void;
  onEditField: (id: string, field: keyof OrgChartRow, value: string) => void;
  onDuplicateAction: (id: string, action: DuplicateAction) => void;
  onApplyToAll: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const selectedCount = rows.filter((r) => r.selected).length;
  const missingRequiredCount = rows.filter(
    (r) => !r.full_name.trim() || !r.job_title.trim()
  ).length;

  const handleSelectAll = (checked: boolean) => {
    rows.forEach((row) => onSelectRow(row.id, checked));
  };

  const allSelected = rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected) && !allSelected;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-primary/30 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-primary" />
              )}
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm text-primary">
                  Suggested: {suggestedDepartment}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {selectedCount}/{rows.length}
              </Badge>
              {missingRequiredCount > 0 && (
                <Badge variant="outline" className="text-xs text-warning border-warning/50">
                  {missingRequiredCount} missing fields
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                onClick={onApplyToAll}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Apply to All
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-[250px]">
            <Table>
              <TableBody>
                {rows.map((row) => (
                  <ReviewTableRow
                    key={row.id}
                    row={row}
                    onSelect={onSelectRow}
                    onEditField={onEditField}
                    onDuplicateAction={onDuplicateAction}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Title cluster group for grouped by title level view
function TitleClusterGroup({
  cluster,
  rows,
  onSelectRow,
  onEditField,
  onDuplicateAction,
}: {
  cluster: string;
  rows: OrgChartRow[];
  onSelectRow: (id: string, checked: boolean) => void;
  onEditField: (id: string, field: keyof OrgChartRow, value: string) => void;
  onDuplicateAction: (id: string, action: DuplicateAction) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [bulkDept, setBulkDept] = useState("");
  const selectedCount = rows.filter((r) => r.selected).length;
  const missingDeptCount = rows.filter((r) => !r.department.trim()).length;
  const missingRequiredCount = rows.filter(
    (r) => !r.full_name.trim() || !r.job_title.trim() || !r.department.trim()
  ).length;

  const handleSelectAll = (checked: boolean) => {
    rows.forEach((row) => onSelectRow(row.id, checked));
  };

  const handleApplyDeptToAll = () => {
    if (!bulkDept.trim()) return;
    rows.forEach((row) => onEditField(row.id, "department", bulkDept));
    setBulkDept("");
  };

  const allSelected = rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected) && !allSelected;

  // Get an icon based on the cluster
  const getClusterIcon = () => {
    switch (cluster) {
      case "Executive / C-Suite":
        return "👔";
      case "Head / VP":
        return "📊";
      case "Director":
        return "📋";
      case "Manager":
        return "👥";
      default:
        return "💼";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-base">{getClusterIcon()}</span>
              <span className="font-medium text-sm">{cluster}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedCount}/{rows.length}
              </Badge>
              {missingDeptCount > 0 && (
                <Badge variant="outline" className="text-xs text-warning border-warning/50">
                  {missingDeptCount} need dept
                </Badge>
              )}
              {missingRequiredCount > 0 && missingRequiredCount !== missingDeptCount && (
                <Badge variant="destructive" className="text-xs">
                  {missingRequiredCount} errors
                </Badge>
              )}
            </div>
            {missingDeptCount > 0 && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <FlexibleCombobox
                  value={bulkDept}
                  onChange={setBulkDept}
                  options={departmentOptions}
                  placeholder="Set department..."
                  className="w-[160px]"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyDeptToAll}
                  disabled={!bulkDept.trim()}
                >
                  Apply All
                </Button>
              </div>
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-[250px]">
            <Table>
              <TableBody>
                {rows.map((row) => (
                  <ReviewTableRow
                    key={row.id}
                    row={row}
                    onSelect={onSelectRow}
                    onEditField={onEditField}
                    onDuplicateAction={onDuplicateAction}
                  />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Inline editable text cell component
function EditableTextCell({
  value,
  onChange,
  hasError = false,
  placeholder = "—",
}: {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(localValue.trim());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setLocalValue(value);
            setIsEditing(false);
          }
        }}
        autoFocus
        className={cn("h-7 text-xs", hasError && "ring-2 ring-destructive/50")}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "text-left text-xs hover:text-primary hover:underline underline-offset-2 w-full truncate px-2 py-1 rounded",
        hasError && "text-destructive ring-2 ring-destructive/50"
      )}
      onClick={() => {
        setLocalValue(value);
        setIsEditing(true);
      }}
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </button>
  );
}

// Row status cell with duplicate action handling
function RowStatusCell({
  row,
  onDuplicateAction,
}: {
  row: OrgChartRow;
  onDuplicateAction: (action: DuplicateAction) => void;
}) {
  const hasErrors = row.validationErrors.length > 0;

  if (row.selected && hasErrors) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Missing fields</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[200px]">
          <ul className="text-xs space-y-1">
            {row.validationErrors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (row.isDuplicate) {
    if (row.duplicateAction) {
      return (
        <div className="flex items-center gap-2">
          <DuplicateActionBadge action={row.duplicateAction} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDuplicateAction(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <Select
        value=""
        onValueChange={(val) => onDuplicateAction(val as DuplicateAction)}
      >
        <SelectTrigger className="h-7 text-xs w-[130px] border-warning/50">
          <SelectValue placeholder="Choose action..." />
        </SelectTrigger>
        <SelectContent className="bg-popover border shadow-lg z-50">
          <SelectItem value="merge">
            <div className="flex items-center gap-2">
              <GitMerge className="h-3 w-3" />
              Merge
            </div>
          </SelectItem>
          <SelectItem value="create_new">
            <div className="flex items-center gap-2">
              <Plus className="h-3 w-3" />
              Create new
            </div>
          </SelectItem>
          <SelectItem value="skip">
            <div className="flex items-center gap-2">
              <X className="h-3 w-3" />
              Skip
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (row.selected && !hasErrors) {
    return (
      <div className="flex items-center gap-1 text-primary">
        <Check className="h-4 w-4" />
        <span className="text-xs">Ready</span>
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

// Badge for selected duplicate action
function DuplicateActionBadge({ action }: { action: DuplicateAction }) {
  if (!action) return null;

  const configs: Record<NonNullable<DuplicateAction>, { label: string; className: string; icon: React.ReactNode }> = {
    merge: {
      label: "Merge",
      className: "bg-primary/10 text-primary border-primary/30",
      icon: <GitMerge className="h-3 w-3" />,
    },
    create_new: {
      label: "New",
      className: "bg-primary/10 text-primary border-primary/30",
      icon: <Plus className="h-3 w-3" />,
    },
    skip: {
      label: "Skip",
      className: "bg-muted text-muted-foreground border-muted",
      icon: <X className="h-3 w-3" />,
    },
  };

  const config = configs[action];

  return (
    <Badge variant="outline" className={cn("text-xs gap-1", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
