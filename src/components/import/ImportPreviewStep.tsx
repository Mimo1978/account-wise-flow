import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ParsedRow, FieldSchema, EntityType, getEntityLabel } from "./ImportCenterTypes";

interface ImportPreviewStepProps {
  entityType: EntityType;
  parsedRows: ParsedRow[];
  fieldSchema: FieldSchema[];
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onDownloadErrors: () => void;
  isProcessing: boolean;
  progress?: number;
}

export function ImportPreviewStep({
  entityType,
  parsedRows,
  fieldSchema,
  onToggleRow,
  onToggleAll,
  onDownloadErrors,
  isProcessing,
  progress = 0,
}: ImportPreviewStepProps) {
  const validRowsCount = useMemo(
    () => parsedRows.filter((r) => r.isValid).length,
    [parsedRows]
  );

  const selectedRowsCount = useMemo(
    () => parsedRows.filter((r) => r.selected).length,
    [parsedRows]
  );

  const errorRowsCount = useMemo(
    () => parsedRows.filter((r) => !r.isValid).length,
    [parsedRows]
  );

  const allSelected = parsedRows.filter((r) => r.isValid).every((r) => r.selected);
  const someSelected = parsedRows.some((r) => r.selected) && !allSelected;

  // Get the main display fields (first 4-5 fields from schema)
  const displayFields = fieldSchema.slice(0, 5);

  return (
    <div className="space-y-4 py-4">
      {/* Summary Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm">{validRowsCount} valid</span>
          </div>
          {errorRowsCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm">{errorRowsCount} with errors</span>
            </div>
          )}
          <Badge variant="secondary">
            {selectedRowsCount} selected to import
          </Badge>
        </div>
        {errorRowsCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownloadErrors}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Errors
          </Button>
        )}
      </div>

      {/* Progress Bar (during import) */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            Importing {getEntityLabel(entityType, true).toLowerCase()}...
          </p>
        </div>
      )}

      {/* Preview Table */}
      <ScrollArea className="h-[300px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all valid rows"
                  className={cn(someSelected && "data-[state=checked]:bg-muted")}
                />
              </TableHead>
              <TableHead className="w-12">Status</TableHead>
              {displayFields.map((field) => (
                <TableHead key={field.id} className="min-w-[120px]">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedRows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  !row.isValid && "bg-red-500/5",
                  row.selected && "bg-primary/5"
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={() => onToggleRow(row.id)}
                    disabled={!row.isValid}
                    aria-label={`Select row ${row.id}`}
                  />
                </TableCell>
                <TableCell>
                  {row.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-4 w-4 text-destructive cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <ul className="text-xs list-disc list-inside">
                          {row.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                {displayFields.map((field) => (
                  <TableCell key={field.id} className="max-w-[200px] truncate">
                    {renderFieldValue(row.mapped[field.id], field)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function renderFieldValue(value: any, field: FieldSchema): React.ReactNode {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 2).map((v, idx) => (
          <Badge key={idx} variant="outline" className="text-xs">
            {String(v)}
          </Badge>
        ))}
        {value.length > 2 && (
          <Badge variant="secondary" className="text-xs">
            +{value.length - 2}
          </Badge>
        )}
      </div>
    );
  }

  return <span className="text-sm">{String(value)}</span>;
}
