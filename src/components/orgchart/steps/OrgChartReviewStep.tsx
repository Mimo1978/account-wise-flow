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
import { FlexibleCombobox } from "@/components/canvas/FlexibleCombobox";
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import { cn } from "@/lib/utils";
import { departmentOptions, jobTitleOptionsFlat } from "@/lib/dropdown-options";
import { AlertCircle, AlertTriangle, Check, GitMerge, Plus, X } from "lucide-react";
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

export function OrgChartReviewStep({
  extractedRows,
  onExtractedRowsChange,
}: OrgChartReviewStepProps) {
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

  const selectedCount = extractedRows.filter((r) => r.selected).length;
  const lowConfidenceCount = extractedRows.filter((r) => r.confidence === "low").length;
  const duplicateCount = extractedRows.filter((r) => r.isDuplicate).length;
  const errorCount = extractedRows.filter(
    (r) => r.selected && r.validationErrors.length > 0
  ).length;
  const unhandledDuplicates = extractedRows.filter(
    (r) => r.selected && r.isDuplicate && r.duplicateAction === null
  ).length;

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
        // Re-validate on field change
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

  const allSelected = extractedRows.every((r) => r.selected);
  const someSelected = extractedRows.some((r) => r.selected) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Summary & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
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
          {lowConfidenceCount > 0 && (
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              {lowConfidenceCount} low confidence
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {errorCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectInvalid}
            >
              Deselect Invalid
            </Button>
          )}
          {lowConfidenceCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectLowConfidence}
            >
              Deselect Low Confidence
            </Button>
          )}
          {duplicateCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectDuplicates}
            >
              Deselect Duplicates
            </Button>
          )}
        </div>
      </div>

      {/* Validation Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
        <span className="font-medium">Required fields:</span>
        <span>Name *</span>
        <span>Job Title *</span>
        <span>Department *</span>
      </div>

      {/* Editable Table */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] sticky left-0 bg-background z-10">
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
                <TableHead className="w-[160px]">Name *</TableHead>
                <TableHead className="w-[180px]">Job Title *</TableHead>
                <TableHead className="w-[150px]">Department *</TableHead>
                <TableHead className="w-[100px]">Location</TableHead>
                <TableHead className="w-[80px]">Confidence</TableHead>
                <TableHead className="w-[160px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedRows.map((row) => {
                const hasErrors = row.validationErrors.length > 0;
                const needsDuplicateAction = row.isDuplicate && row.duplicateAction === null;

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      !row.selected && "opacity-50 bg-muted/30",
                      row.selected && hasErrors && "bg-destructive/5",
                      row.selected && row.isDuplicate && !hasErrors && "bg-orange-500/5"
                    )}
                  >
                    <TableCell className="sticky left-0 bg-background z-10">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={(checked) =>
                          handleSelectRow(row.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <EditableTextCell
                        value={row.full_name}
                        onChange={(val) => handleEditField(row.id, "full_name", val)}
                        hasError={row.selected && !row.full_name.trim()}
                        placeholder="Enter name"
                      />
                    </TableCell>
                    <TableCell>
                      <FlexibleCombobox
                        value={row.job_title}
                        onChange={(val) => handleEditField(row.id, "job_title", val)}
                        options={jobTitleOptionsFlat}
                        placeholder="Select or type..."
                        className={cn(
                          row.selected && !row.job_title.trim() && "ring-2 ring-destructive/50 rounded-md"
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FlexibleCombobox
                        value={row.department}
                        onChange={(val) => handleEditField(row.id, "department", val)}
                        options={departmentOptions}
                        placeholder="Select or type..."
                        className={cn(
                          row.selected && !row.department.trim() && "ring-2 ring-destructive/50 rounded-md"
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableTextCell
                        value={row.location}
                        onChange={(val) => handleEditField(row.id, "location", val)}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={row.confidence} />
                    </TableCell>
                    <TableCell>
                      <RowStatusCell
                        row={row}
                        onDuplicateAction={(action) => handleDuplicateAction(row.id, action)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">
        Click on any cell to edit. All required fields must be filled for selected rows.
        Duplicates require an action before proceeding.
      </p>
    </div>
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
      className={cn(
        "text-left text-sm hover:text-primary hover:underline underline-offset-2 w-full truncate px-2 py-1 rounded",
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

  // Show validation errors
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

  // Show duplicate handling
  if (row.isDuplicate) {
    if (row.duplicateAction) {
      // Show selected action
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

    // Show action selector
    return (
      <Select
        value=""
        onValueChange={(val) => onDuplicateAction(val as DuplicateAction)}
      >
        <SelectTrigger className="h-7 text-xs w-[140px] border-warning/50">
          <SelectValue placeholder="Choose action..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="merge">
            <div className="flex items-center gap-2">
              <GitMerge className="h-3 w-3" />
              Merge with existing
            </div>
          </SelectItem>
          <SelectItem value="create_new">
            <div className="flex items-center gap-2">
              <Plus className="h-3 w-3" />
              Create new anyway
            </div>
          </SelectItem>
          <SelectItem value="skip">
            <div className="flex items-center gap-2">
              <X className="h-3 w-3" />
              Skip this row
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Valid row
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
      label: "Create new",
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
    <Badge variant="outline" className={cn("text-xs py-0.5 gap-1", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
