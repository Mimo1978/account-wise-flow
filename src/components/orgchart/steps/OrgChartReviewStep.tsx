import { useState } from "react";
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
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import { cn } from "@/lib/utils";
import type { OrgChartRow } from "../OrgChartBuilderModal";

interface OrgChartReviewStepProps {
  extractedRows: OrgChartRow[];
  onExtractedRowsChange: (rows: OrgChartRow[]) => void;
}

export function OrgChartReviewStep({
  extractedRows,
  onExtractedRowsChange,
}: OrgChartReviewStepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedCount = extractedRows.filter((r) => r.selected).length;
  const lowConfidenceCount = extractedRows.filter((r) => r.confidence === "low").length;
  const duplicateCount = extractedRows.filter((r) => r.isDuplicate).length;

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
      extractedRows.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
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

  const allSelected = extractedRows.every((r) => r.selected);
  const someSelected = extractedRows.some((r) => r.selected) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Summary & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="py-1.5">
            {selectedCount} / {extractedRows.length} selected
          </Badge>
          {lowConfidenceCount > 0 && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
              {lowConfidenceCount} low confidence
            </Badge>
          )}
          {duplicateCount > 0 && (
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
              {duplicateCount} duplicates
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Editable Table */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[350px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
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
                <TableHead className="w-[180px]">Name *</TableHead>
                <TableHead className="w-[150px]">Job Title</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[100px]">Location</TableHead>
                <TableHead className="w-[80px]">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    !row.selected && "opacity-50 bg-muted/30",
                    row.isDuplicate && row.selected && "bg-orange-500/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={row.selected}
                      onCheckedChange={(checked) =>
                        handleSelectRow(row.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {editingId === row.id ? (
                      <Input
                        value={row.full_name}
                        onChange={(e) =>
                          handleEditField(row.id, "full_name", e.target.value)
                        }
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <button
                        className="text-left font-medium hover:text-primary hover:underline underline-offset-2 w-full"
                        onClick={() => setEditingId(row.id)}
                      >
                        {row.full_name || (
                          <span className="text-destructive italic">Missing</span>
                        )}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={row.job_title}
                      onChange={(val) => handleEditField(row.id, "job_title", val)}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={row.department}
                      onChange={(val) => handleEditField(row.id, "department", val)}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={row.location}
                      onChange={(val) => handleEditField(row.id, "location", val)}
                    />
                  </TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={row.confidence} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">
        Click on any cell to edit. Rows must have a name to be imported.
      </p>
    </div>
  );
}

// Inline editable cell component
function EditableCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        autoFocus
        className="h-8"
      />
    );
  }

  return (
    <button
      className="text-left text-sm hover:text-primary hover:underline underline-offset-2 w-full truncate"
      onClick={() => {
        setLocalValue(value);
        setIsEditing(true);
      }}
    >
      {value || <span className="text-muted-foreground">—</span>}
    </button>
  );
}
