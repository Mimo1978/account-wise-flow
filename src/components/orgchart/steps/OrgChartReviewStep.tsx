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
import { FlexibleCombobox } from "@/components/canvas/FlexibleCombobox";
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import { cn } from "@/lib/utils";
import { departmentOptions, jobTitleOptionsFlat } from "@/lib/dropdown-options";
import { applySmartDepartments, inferDepartmentFromTitle } from "@/lib/department-inference";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
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

export function OrgChartReviewStep({
  extractedRows,
  onExtractedRowsChange,
}: OrgChartReviewStepProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkTitle, setBulkTitle] = useState("");

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
  const missingDepartmentCount = extractedRows.filter(
    (r) => r.selected && !r.department.trim()
  ).length;

  // Count how many can be auto-inferred
  const autoInferableCount = extractedRows.filter(
    (r) => r.selected && !r.department.trim() && r.job_title.trim() && inferDepartmentFromTitle(r.job_title)
  ).length;

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

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    onExtractedRowsChange(
      extractedRows.map((row) => ({ ...row, selected: checked }))
    );
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

  const handleDeselectLowConfidence = () => {
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.confidence === "low" ? { ...row, selected: false } : row
      )
    );
  };

  const handleDeselectDuplicates = () => {
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.isDuplicate ? { ...row, selected: false } : row
      )
    );
  };

  const handleDeselectInvalid = () => {
    onExtractedRowsChange(
      extractedRows.map((row) =>
        row.validationErrors.length > 0 ? { ...row, selected: false } : row
      )
    );
  };

  // Bulk apply handlers
  const handleBulkApplyDepartment = () => {
    if (!bulkDepartment.trim()) return;
    onExtractedRowsChange(
      extractedRows.map((row) => {
        if (!row.selected) return row;
        const updated = { ...row, department: bulkDepartment };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
    setBulkDepartment("");
  };

  const handleBulkApplyTitle = () => {
    if (!bulkTitle.trim()) return;
    onExtractedRowsChange(
      extractedRows.map((row) => {
        if (!row.selected) return row;
        const updated = { ...row, job_title: bulkTitle };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
    setBulkTitle("");
  };

  // Smart auto-fill department
  const handleAutoFillDepartments = () => {
    const { updatedRows, filledCount } = applySmartDepartments(extractedRows);
    if (filledCount > 0) {
      onExtractedRowsChange(
        updatedRows.map((row) => ({
          ...row,
          validationErrors: validateRow(row),
        }))
      );
    }
  };

  // Apply department to all rows in a group
  const handleApplyDepartmentToGroup = (groupDept: string, newDept: string) => {
    onExtractedRowsChange(
      extractedRows.map((row) => {
        if (row.department !== groupDept) return row;
        const updated = { ...row, department: newDept };
        updated.validationErrors = validateRow(updated);
        return updated;
      })
    );
  };

  const allSelected = extractedRows.every((r) => r.selected);
  const someSelected = extractedRows.some((r) => r.selected) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Summary Badges */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="py-1.5">
            {selectedCount} / {extractedRows.length} selected
          </Badge>
          {errorCount > 0 && (
            <Badge variant="destructive" className="py-1.5">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errorCount} with errors
            </Badge>
          )}
          {unhandledDuplicates > 0 && (
            <Badge variant="secondary" className="bg-warning/10 text-warning-foreground py-1.5">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {unhandledDuplicates} duplicates need action
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          <Button
            variant={viewMode === "grouped" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grouped")}
          >
            By Department
          </Button>
        </div>
      </div>

      {/* Smart Auto-fill Banner */}
      {autoInferableCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <span className="font-medium">{autoInferableCount} rows</span> can be auto-filled with department based on job title
            </span>
          </div>
          <Button size="sm" onClick={handleAutoFillDepartments} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Auto-fill Departments
          </Button>
        </div>
      )}

      {/* Bulk Apply Toolbar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-4 flex-wrap bg-muted/50 border rounded-lg p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Bulk apply to {selectedCount} selected:
          </span>
          
          {/* Bulk Department */}
          <div className="flex items-center gap-2">
            <FlexibleCombobox
              value={bulkDepartment}
              onChange={setBulkDepartment}
              options={departmentOptions}
              placeholder="Department..."
              className="w-[180px]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkApplyDepartment}
              disabled={!bulkDepartment.trim()}
            >
              Apply
            </Button>
          </div>

          {/* Bulk Title */}
          <div className="flex items-center gap-2">
            <FlexibleCombobox
              value={bulkTitle}
              onChange={setBulkTitle}
              options={jobTitleOptionsFlat}
              placeholder="Job Title..."
              className="w-[180px]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBulkApplyTitle}
              disabled={!bulkTitle.trim()}
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {errorCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleDeselectInvalid}>
            Deselect Invalid
          </Button>
        )}
        {lowConfidenceCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleDeselectLowConfidence}>
            Deselect Low Confidence
          </Button>
        )}
        {duplicateCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleDeselectDuplicates}>
            Deselect Duplicates
          </Button>
        )}
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
        row.selected && row.isDuplicate && !hasErrors && "bg-orange-500/5"
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
        <div className="space-y-1">
          <FlexibleCombobox
            value={row.department}
            onChange={(val) => onEditField(row.id, "department", val)}
            options={departmentOptions}
            placeholder="Select or type..."
            className={cn(
              row.selected && !row.department.trim() && "ring-2 ring-destructive/50 rounded-md"
            )}
          />
          {suggestedDept && (
            <button
              type="button"
              onClick={() => onEditField(row.id, "department", suggestedDept)}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <Lightbulb className="h-2.5 w-2.5" />
              {suggestedDept}
            </button>
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
        <EditableTextCell
          value={row.email || ""}
          onChange={(val) => onEditField(row.id, "email", val)}
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <EditableTextCell
          value={row.phone || ""}
          onChange={(val) => onEditField(row.id, "phone", val)}
          placeholder="—"
        />
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
        <SelectContent>
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
