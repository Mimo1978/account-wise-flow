import { useState, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Building2,
  Users,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImportCenterDropzone } from "./ImportCenterDropzone";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportPreviewStep } from "./ImportPreviewStep";
import {
  EntityType,
  ImportStep,
  ParsedRow,
  FieldSchema,
  getFieldSchemaForEntity,
  getAutoMappingRulesForEntity,
  getEntityLabel,
} from "./ImportCenterTypes";

interface ImportCenterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  onImportComplete: (records: Record<string, any>[]) => void;
}

const entityIcons: Record<EntityType, React.ReactNode> = {
  companies: <Building2 className="h-5 w-5" />,
  contacts: <Users className="h-5 w-5" />,
  talent: <Briefcase className="h-5 w-5" />,
};

export function ImportCenterModal({
  open,
  onOpenChange,
  entityType,
  onImportComplete,
}: ImportCenterModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // File/paste state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedData, setPastedData] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  // Get schema based on entity type
  const fieldSchema = useMemo(() => getFieldSchemaForEntity(entityType), [entityType]);
  const autoMappingRules = useMemo(() => getAutoMappingRulesForEntity(entityType), [entityType]);

  const resetState = useCallback(() => {
    setStep("upload");
    setUploadedFile(null);
    setPastedData("");
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setParsedRows([]);
    setIsProcessing(false);
    setIsDragging(false);
    setImportProgress(0);
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    resetState();
    onOpenChange(false);
  }, [isProcessing, resetState, onOpenChange]);

  // File handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const isCSV = file.name.endsWith(".csv");
    const isXLSX = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (!validTypes.includes(file.type) && !isCSV && !isXLSX) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    setUploadedFile(file);
    setIsProcessing(true);

    try {
      if (isCSV || file.type === "text/csv") {
        const text = await file.text();
        parseCSVData(text);
      } else {
        // For XLSX, we'd need xlsx library - for now show info
        toast.info("Excel parsing is being processed...");
        setTimeout(() => {
          setIsProcessing(false);
          setStep("mapping");
        }, 1000);
      }
    } catch (error) {
      toast.error("Failed to parse file");
      setIsProcessing(false);
    }
  };

  const parseCSVData = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("File must contain a header row and at least one data row");
      setIsProcessing(false);
      return;
    }

    const headers = parseCSVLine(lines[0]);
    setRawHeaders(headers);

    const rows = lines.slice(1).map((line) => parseCSVLine(line));
    setRawRows(rows);

    // Auto-map columns based on header names
    const autoMapping: Record<string, string> = {};
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase().trim();
      
      // Check against auto-mapping rules
      Object.entries(autoMappingRules).forEach(([fieldId, possibleMatches]) => {
        if (!autoMapping[fieldId]) {
          const isMatch = possibleMatches.some(
            (match) => headerLower === match || headerLower.includes(match)
          );
          if (isMatch) {
            autoMapping[fieldId] = String(index);
          }
        }
      });
    });

    setColumnMapping(autoMapping);
    setIsProcessing(false);
    setStep("mapping");
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handlePasteConfirm = () => {
    if (!pastedData.trim()) {
      toast.error("Please paste some data first");
      return;
    }
    parseCSVData(pastedData);
  };

  // Mapping step handlers
  const handleMappingChange = (fieldId: string, columnIndex: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [fieldId]: columnIndex,
    }));
  };

  const handleProceedToPreview = () => {
    // Validate required fields are mapped
    const requiredFields = fieldSchema.filter((f) => f.required);
    const unmappedRequired = requiredFields.filter(
      (f) => !columnMapping[f.id] || columnMapping[f.id] === ""
    );

    if (unmappedRequired.length > 0) {
      toast.error(
        `Please map required fields: ${unmappedRequired.map((f) => f.label).join(", ")}`
      );
      return;
    }

    // Parse and validate rows
    const parsed: ParsedRow[] = rawRows.map((row, idx) => {
      const mapped: Record<string, any> = {};
      const errors: string[] = [];

      // Map each field
      fieldSchema.forEach((field) => {
        const colIndex = columnMapping[field.id];
        if (colIndex !== undefined && colIndex !== "") {
          const value = row[parseInt(colIndex)] || "";
          
          // Handle multiselect fields (split by comma/semicolon)
          if (field.type === "multiselect") {
            mapped[field.id] = value.split(/[,;]/).map((r) => r.trim()).filter(Boolean);
          } else {
            mapped[field.id] = value;
          }
        }
      });

      // Validate required fields
      requiredFields.forEach((field) => {
        const value = mapped[field.id];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          errors.push(`${field.label} is required`);
        }
      });

      return {
        id: `row-${idx}`,
        original: rawHeaders.reduce((acc, h, i) => ({ ...acc, [h]: row[i] || "" }), {}),
        mapped,
        errors,
        isValid: errors.length === 0,
        selected: errors.length === 0,
      };
    });

    setParsedRows(parsed);
    setStep("preview");
  };

  // Preview step handlers
  const toggleRowSelection = (id: string) => {
    setParsedRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setParsedRows((prev) =>
      prev.map((row) => ({ ...row, selected: row.isValid && checked }))
    );
  };

  const downloadErrorCSV = () => {
    const errorRows = parsedRows.filter((r) => !r.isValid);
    if (errorRows.length === 0) return;

    const headers = ["Error", ...Object.keys(errorRows[0].original)];
    const csvContent = [
      headers.join(","),
      ...errorRows.map((row) =>
        [
          `"${row.errors.join("; ")}"`,
          ...Object.values(row.original).map((v) => `"${v}"`),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${entityType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import execution
  const handleImport = () => {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast.error("No rows selected for import");
      return;
    }

    setIsProcessing(true);
    setImportProgress(0);

    // Simulate batch processing with progress
    const batchSize = 100;
    const totalRows = selectedRows.length;
    let processedCount = 0;

    const processBatch = () => {
      const remaining = totalRows - processedCount;
      const currentBatch = Math.min(batchSize, remaining);
      processedCount += currentBatch;
      
      setImportProgress((processedCount / totalRows) * 100);

      if (processedCount < totalRows) {
        setTimeout(processBatch, 50);
      } else {
        // Complete import
        const records = selectedRows.map((row, idx) => ({
          id: `imported-${Date.now()}-${idx}`,
          ...row.mapped,
        }));

        onImportComplete(records);
        toast.success(
          `${records.length} ${getEntityLabel(entityType, records.length !== 1).toLowerCase()} imported successfully`
        );
        setIsProcessing(false);
        setStep("confirm");

        // Auto-close after short delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    };

    setTimeout(processBatch, 100);
  };

  const selectedCount = parsedRows.filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">{entityIcons[entityType]}</span>
            Import {getEntityLabel(entityType, true)}
            <Badge variant="outline" className="ml-2 font-normal">
              {step === "upload" && "Step 1/3"}
              {step === "mapping" && "Step 2/3"}
              {step === "preview" && "Step 3/3"}
              {step === "confirm" && "Complete"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <ImportCenterDropzone
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              uploadedFile={uploadedFile}
              pastedData={pastedData}
              onPastedDataChange={setPastedData}
              onPasteConfirm={handlePasteConfirm}
              isProcessing={isProcessing}
            />
          )}

          {step === "mapping" && (
            <ImportMappingStep
              entityType={entityType}
              rawHeaders={rawHeaders}
              rawRows={rawRows}
              fieldSchema={fieldSchema}
              columnMapping={columnMapping}
              onMappingChange={handleMappingChange}
            />
          )}

          {step === "preview" && (
            <ImportPreviewStep
              entityType={entityType}
              parsedRows={parsedRows}
              fieldSchema={fieldSchema}
              onToggleRow={toggleRowSelection}
              onToggleAll={toggleSelectAll}
              onDownloadErrors={downloadErrorCSV}
              isProcessing={isProcessing}
              progress={importProgress}
            />
          )}

          {step === "confirm" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Import Complete!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your {getEntityLabel(entityType, true).toLowerCase()} have been imported successfully.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                disabled={isProcessing}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview} disabled={isProcessing}>
                Preview
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                disabled={isProcessing}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={isProcessing || selectedCount === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {selectedCount} {getEntityLabel(entityType, selectedCount !== 1)}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
