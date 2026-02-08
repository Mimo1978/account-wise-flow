import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import { FieldSchema, EntityType, getEntityLabel } from "./ImportCenterTypes";

interface ImportMappingStepProps {
  entityType: EntityType;
  rawHeaders: string[];
  rawRows: string[][];
  fieldSchema: FieldSchema[];
  columnMapping: Record<string, string>;
  onMappingChange: (fieldId: string, columnIndex: string) => void;
}

export function ImportMappingStep({
  entityType,
  rawHeaders,
  rawRows,
  fieldSchema,
  columnMapping,
  onMappingChange,
}: ImportMappingStepProps) {
  // Count mapped required fields
  const SKIP_VALUE = "__skip__";

  const mappedRequiredCount = useMemo(() => {
    return fieldSchema.filter(
      (f) => f.required && columnMapping[f.id] !== undefined && columnMapping[f.id] !== "" && columnMapping[f.id] !== SKIP_VALUE
    ).length;
  }, [fieldSchema, columnMapping]);

  const requiredFieldsCount = useMemo(
    () => fieldSchema.filter((f) => f.required).length,
    [fieldSchema]
  );

  const allRequiredMapped = mappedRequiredCount === requiredFieldsCount;

  // Preview first 3 rows
  const previewRows = rawRows.slice(0, 3);

  return (
    <div className="space-y-6 py-4">
      {/* Mapping Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allRequiredMapped ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          )}
          <span className="text-sm">
            {mappedRequiredCount} / {requiredFieldsCount} required fields mapped
          </span>
        </div>
        <Badge variant="outline">
          {rawRows.length} {getEntityLabel(entityType, rawRows.length !== 1)} to import
        </Badge>
      </div>

      {/* Field Mapping Grid */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Map your columns to {getEntityLabel(entityType)} fields</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fieldSchema.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-3 p-2 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && (
                    <span className="text-red-500 text-xs">*</span>
                  )}
                </div>
              </div>
              <Select
                value={columnMapping[field.id] ?? ""}
                onValueChange={(v) => onMappingChange(field.id, v === SKIP_VALUE ? "" : v)}
              >
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                  {rawHeaders.map((header, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {header || `Column ${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            Preview of first {previewRows.length} rows
          </div>
          <div className="rounded-lg border overflow-auto max-h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  {rawHeaders.map((header, idx) => (
                    <TableHead key={idx} className="text-xs whitespace-nowrap">
                      {header || `Column ${idx + 1}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <TableCell key={cellIdx} className="text-xs py-2">
                        {cell || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
