import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Building2,
  Users,
  Briefcase,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ImportCenterDropzone } from "./ImportCenterDropzone";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportPreviewStep } from "./ImportPreviewStep";
import { OCRUploadStep } from "./OCRUploadStep";
import { CompanyReviewStep, CompanyReviewItem, ReviewDecision } from "./CompanyReviewStep";
import { useCompanyImport } from "@/hooks/use-company-import";
import { detectCompanyNameColumn } from "@/lib/import-utils";
import {
  EntityType,
  ImportStep,
  ImportMethod,
  ParsedRow,
  FieldSchema,
  ConfidenceLevel,
  OCRResult,
  getFieldSchemaForEntity,
  getAutoMappingRulesForEntity,
  getEntityLabel,
} from "./ImportCenterTypes";

interface ImportCenterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  onImportComplete: (records: Record<string, any>[]) => void;
  initialMethod?: ImportMethod;
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
  initialMethod = "file",
}: ImportCenterModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>(initialMethod === "ocr" ? "ocr-upload" : "upload");
  const [importMethod, setImportMethod] = useState<ImportMethod>(initialMethod);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // File/paste state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedData, setPastedData] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // OCR state
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isOcrMode, setIsOcrMode] = useState(initialMethod === "ocr");

  // Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappingWarning, setMappingWarning] = useState<string | null>(null);
  const [nameColumnDetected, setNameColumnDetected] = useState(false);

  // Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);

  // Company review state (only for companies entity)
  const [reviewItems, setReviewItems] = useState<CompanyReviewItem[]>([]);
  const {
    detectColumn,
    buildReviewItems,
    saveCompanies,
    isLoadingDuplicates,
    isSaving,
    saveProgress,
  } = useCompanyImport();

  // Get schema based on entity type
  const fieldSchema = useMemo(() => getFieldSchemaForEntity(entityType), [entityType]);
  const autoMappingRules = useMemo(() => getAutoMappingRulesForEntity(entityType), [entityType]);

  const resetState = useCallback(() => {
    const startStep = initialMethod === "ocr" ? "ocr-upload" : "upload";
    setStep(startStep);
    setImportMethod(initialMethod);
    setUploadedFile(null);
    setPastedData("");
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setParsedRows([]);
    setIsProcessing(false);
    setIsDragging(false);
    setImportProgress(0);
    setOcrFile(null);
    setOcrError(null);
    setIsOcrMode(initialMethod === "ocr");
    setMappingWarning(null);
    setNameColumnDetected(false);
    setReviewItems([]);
  }, [initialMethod]);

  const handleClose = useCallback(() => {
    if (isProcessing || isSaving) return;
    resetState();
    onOpenChange(false);
  }, [isProcessing, isSaving, resetState, onOpenChange]);

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

    // For companies, use intelligent column detection
    let autoMapping: Record<string, string> = {};
    let warning: string | null = null;
    let detected = false;

    if (entityType === "companies") {
      // Use smart detection for company name
      const detection = detectCompanyNameColumn(headers, rows.slice(0, 5));
      
      if (detection.columnIndex !== null) {
        autoMapping.name = String(detection.columnIndex);
        detected = true;
        
        if (detection.needsConfirmation && detection.alternatives.length > 0) {
          warning = `Detected "${headers[detection.columnIndex]}" as Company Name. Please verify this is correct.`;
        }
      } else {
        warning = "Could not detect Company Name column. Please map it manually below.";
      }

      // Map other fields using standard rules
      headers.forEach((header, index) => {
        if (String(index) === autoMapping.name) return; // Skip already mapped name column
        
        const headerLower = header.toLowerCase().trim();
        Object.entries(autoMappingRules).forEach(([fieldId, possibleMatches]) => {
          if (fieldId === "name") return; // Already handled
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
    } else {
      // Standard auto-mapping for other entities
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().trim();
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
    }

    setColumnMapping(autoMapping);
    setMappingWarning(warning);
    setNameColumnDetected(detected);
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

  // OCR handlers
  const handleOcrFileSelect = (file: File) => {
    setOcrFile(file);
    setOcrError(null);
  };

  const handleOcrClearFile = () => {
    setOcrFile(null);
    setOcrError(null);
  };

  const handleStartOCR = async () => {
    if (!ocrFile) return;

    setIsProcessing(true);
    setOcrError(null);

    try {
      // Convert file to base64
      const arrayBuffer = await ocrFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke("ocr-import", {
        body: {
          image: base64,
          entityType,
          mimeType: ocrFile.type,
        },
      });

      if (error) {
        throw new Error(error.message || "OCR processing failed");
      }

      const result = data as OCRResult;

      if (!result.success) {
        throw new Error("OCR extraction failed");
      }

      if (result.rows.length === 0) {
        throw new Error("No data could be extracted from the image");
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          toast.warning(warning);
        });
      }

      // Convert OCR results to parsed rows
      const ocrParsedRows: ParsedRow[] = result.rows.map((row, idx) => {
        const errors: string[] = [];
        const requiredFields = fieldSchema.filter((f) => f.required);

        // Check required fields
        requiredFields.forEach((field) => {
          const value = row.fields[field.id];
          if (!value || value.trim() === "") {
            errors.push(`${field.label} is required`);
          }
        });

        return {
          id: `ocr-${idx}`,
          original: row.fields,
          mapped: row.fields,
          errors,
          isValid: errors.length === 0,
          // Low confidence rows are unchecked by default
          selected: errors.length === 0 && row.confidence !== "low",
          confidence: row.confidence,
          rawText: row.rawText,
        };
      });

      setParsedRows(ocrParsedRows);
      setIsOcrMode(true);
      setStep("preview");

      toast.success(`Extracted ${result.rows.length} row(s) from image`);
    } catch (err) {
      console.error("OCR error:", err);
      const errorMessage = err instanceof Error ? err.message : "OCR processing failed";
      setOcrError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mapping step handlers
  const handleMappingChange = (fieldId: string, columnIndex: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [fieldId]: columnIndex,
    }));
    // Clear warning when user manually maps
    if (fieldId === "name" && columnIndex) {
      setMappingWarning(null);
      setNameColumnDetected(true);
    }
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

    // Check for zero valid companies
    const validCount = parsed.filter((r) => r.isValid).length;
    if (validCount === 0) {
      toast.error("No valid records found. Please check your data and column mapping.");
      return;
    }

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

  // Proceed to review step (for companies)
  const handleProceedToReview = async () => {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast.error("No rows selected for import");
      return;
    }

    setIsProcessing(true);
    try {
      const items = await buildReviewItems(selectedRows);
      setReviewItems(items);
      setStep("review");
    } catch (error) {
      console.error("Error building review items:", error);
      toast.error("Failed to prepare review. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Review step handlers
  const handleReviewDecisionChange = (
    id: string,
    decision: ReviewDecision,
    matchedCompanyId?: string
  ) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              decision,
              matchedCompanyId: decision === "match" ? matchedCompanyId : undefined,
              matchedCompanyName: decision === "match"
                ? item.duplicateSuggestions.find((s) => s.id === matchedCompanyId)?.name
                : undefined,
            }
          : item
      )
    );
  };

  const handleBulkAction = (action: "create-all" | "skip-all") => {
    setReviewItems((prev) =>
      prev.map((item) => ({
        ...item,
        decision: action === "create-all" 
          ? (item.isValid ? "create" : "skip") 
          : "skip",
        matchedCompanyId: undefined,
        matchedCompanyName: undefined,
      }))
    );
  };

  // Final import execution
  const handleFinalImport = async () => {
    if (entityType === "companies") {
      // Use company-specific saving logic
      const result = await saveCompanies(reviewItems);
      
      if (result.errors.length > 0) {
        toast.error(result.errors[0]);
        return;
      }

      const total = result.created + result.matched;
      if (total === 0) {
        toast.warning("No companies were imported. All rows were skipped.");
        handleClose();
        return;
      }

      // Build result message
      const parts: string[] = [];
      if (result.created > 0) {
        parts.push(`${result.created} created`);
      }
      if (result.matched > 0) {
        parts.push(`${result.matched} matched`);
      }
      if (result.skipped > 0) {
        parts.push(`${result.skipped} skipped`);
      }

      toast.success(`Companies imported: ${parts.join(", ")}`);
      
      // Notify parent and close
      onImportComplete([]);
      setStep("confirm");
      setTimeout(() => {
        handleClose();
      }, 1500);
    } else {
      // Original import logic for other entity types
      handleLegacyImport();
    }
  };

  // Legacy import for non-company entities
  const handleLegacyImport = () => {
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
  const reviewCreateCount = reviewItems.filter((i) => i.decision === "create" && i.isValid).length;
  const reviewMatchCount = reviewItems.filter((i) => i.decision === "match" && i.matchedCompanyId).length;
  const reviewActionCount = reviewCreateCount + reviewMatchCount;

  const getStepNumber = () => {
    if (isOcrMode) {
      if (step === "ocr-upload") return "Step 1/2";
      if (step === "preview") return "Step 2/2";
      if (step === "confirm") return "Complete";
    }
    // Company flow has 4 steps
    if (entityType === "companies") {
      if (step === "upload") return "Step 1/4";
      if (step === "mapping") return "Step 2/4";
      if (step === "preview") return "Step 3/4";
      if (step === "review") return "Step 4/4";
      if (step === "confirm") return "Complete";
    }
    // Other entities have 3 steps
    if (step === "upload") return "Step 1/3";
    if (step === "mapping") return "Step 2/3";
    if (step === "preview") return "Step 3/3";
    if (step === "confirm") return "Complete";
    return "";
  };

  const getStepTitle = () => {
    if (step === "upload") return "Upload";
    if (step === "ocr-upload") return "Upload Image";
    if (step === "mapping") return "Map Columns";
    if (step === "preview") return "Preview Data";
    if (step === "review") return "Review Companies";
    if (step === "confirm") return "Complete";
    return "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">{entityIcons[entityType]}</span>
            Import {getEntityLabel(entityType, true)}
            <Badge variant="outline" className="ml-2 font-normal text-xs">
              {getStepNumber()}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            {getStepTitle()}
            {isOcrMode && " • AI-powered OCR scanning"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <ImportCenterDropzone
              entityType={entityType}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              uploadedFile={uploadedFile}
              onClearFile={() => setUploadedFile(null)}
              pastedData={pastedData}
              onPastedDataChange={setPastedData}
              onPasteConfirm={handlePasteConfirm}
              isProcessing={isProcessing}
            />
          )}

          {step === "ocr-upload" && (
            <OCRUploadStep
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleOcrFileSelect}
              uploadedFile={ocrFile}
              onClearFile={handleOcrClearFile}
              isProcessing={isProcessing}
              onStartOCR={handleStartOCR}
              ocrError={ocrError}
            />
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              {/* Mapping warning */}
              {mappingWarning && (
                <Alert variant={nameColumnDetected ? "default" : "destructive"}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {mappingWarning}
                  </AlertDescription>
                </Alert>
              )}
              
              <ImportMappingStep
                entityType={entityType}
                rawHeaders={rawHeaders}
                rawRows={rawRows}
                fieldSchema={fieldSchema}
                columnMapping={columnMapping}
                onMappingChange={handleMappingChange}
              />
            </div>
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
              showConfidence={isOcrMode}
            />
          )}

          {step === "review" && entityType === "companies" && (
            <CompanyReviewStep
              reviewItems={reviewItems}
              onDecisionChange={handleReviewDecisionChange}
              onBulkAction={handleBulkAction}
              isLoading={isLoadingDuplicates}
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
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "ocr-upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
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
                onClick={() => setStep(isOcrMode ? "ocr-upload" : "mapping")}
                disabled={isProcessing}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              {entityType === "companies" ? (
                <Button
                  onClick={handleProceedToReview}
                  disabled={isProcessing || selectedCount === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Review {selectedCount} Companies
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleLegacyImport}
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
              )}
            </>
          )}

          {step === "review" && entityType === "companies" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("preview")}
                disabled={isSaving}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleFinalImport}
                disabled={isSaving || reviewActionCount === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Import {reviewActionCount} Companies
                    <CheckCircle2 className="h-4 w-4 ml-1" />
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
