import { useState, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  ScanLine,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Loader2,
  Building2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Account, RelationshipStatus } from "@/lib/types";
import { toast } from "sonner";

interface ImportCompaniesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompaniesImported: (companies: Account[]) => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "confirm";
type ImportMethod = "file" | "paste" | "ocr";

interface ParsedRow {
  id: string;
  original: Record<string, string>;
  mapped: Partial<CompanyMappedFields>;
  errors: string[];
  isValid: boolean;
  selected: boolean;
}

interface CompanyMappedFields {
  name: string;
  headquarters: string;
  switchboard: string;
  industry: string;
  regions: string[];
  status: RelationshipStatus;
  owner: string;
  notes: string;
}

const COMPANY_FIELDS = [
  { id: "name", label: "Company Name", required: true },
  { id: "headquarters", label: "Headquarters", required: false },
  { id: "switchboard", label: "Switchboard", required: false },
  { id: "industry", label: "Industry", required: false },
  { id: "regions", label: "Regions", required: false },
  { id: "status", label: "Status", required: false },
  { id: "owner", label: "Owner", required: false },
  { id: "notes", label: "Notes", required: false },
];

const STATUS_OPTIONS: { value: RelationshipStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "warm", label: "Warm" },
  { value: "cooling", label: "Cooling" },
  { value: "dormant", label: "Dormant" },
];

export function ImportCompaniesModal({
  open,
  onOpenChange,
  onCompaniesImported,
}: ImportCompaniesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [importMethod, setImportMethod] = useState<ImportMethod | null>(null);
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

  const resetState = useCallback(() => {
    setStep("upload");
    setImportMethod(null);
    setUploadedFile(null);
    setPastedData("");
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setParsedRows([]);
    setIsProcessing(false);
    setIsDragging(false);
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
    setImportMethod("file");
    setIsProcessing(true);

    try {
      // Parse CSV (for simplicity, we'll handle CSV for now)
      if (isCSV || file.type === "text/csv") {
        const text = await file.text();
        parseCSVData(text);
      } else {
        // For XLSX, we'd need a library like xlsx
        toast.info("Excel parsing is being processed...");
        // Mock parse for demo
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

    // Parse headers
    const headers = parseCSVLine(lines[0]);
    setRawHeaders(headers);

    // Parse rows
    const rows = lines.slice(1).map((line) => parseCSVLine(line));
    setRawRows(rows);

    // Auto-map columns based on header names
    const autoMapping: Record<string, string> = {};
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase().trim();
      COMPANY_FIELDS.forEach((field) => {
        if (
          headerLower.includes(field.id.toLowerCase()) ||
          headerLower.includes(field.label.toLowerCase())
        ) {
          if (!autoMapping[field.id]) {
            autoMapping[field.id] = String(index);
          }
        }
      });
      // Special cases
      if (
        headerLower.includes("company") ||
        headerLower.includes("organization") ||
        headerLower === "name"
      ) {
        if (!autoMapping["name"]) autoMapping["name"] = String(index);
      }
      if (headerLower.includes("hq") || headerLower.includes("location") || headerLower.includes("city")) {
        if (!autoMapping["headquarters"]) autoMapping["headquarters"] = String(index);
      }
      if (headerLower.includes("phone") || headerLower.includes("tel")) {
        if (!autoMapping["switchboard"]) autoMapping["switchboard"] = String(index);
      }
      if (headerLower.includes("region") || headerLower.includes("country")) {
        if (!autoMapping["regions"]) autoMapping["regions"] = String(index);
      }
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

  const handlePasteData = () => {
    if (!pastedData.trim()) {
      toast.error("Please paste some data first");
      return;
    }

    setImportMethod("paste");
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
    if (!columnMapping["name"]) {
      toast.error("Company Name is required. Please map it to a column.");
      return;
    }

    // Parse and validate rows
    const parsed: ParsedRow[] = rawRows.map((row, idx) => {
      const mapped: Partial<CompanyMappedFields> = {};
      const errors: string[] = [];

      // Map each field
      COMPANY_FIELDS.forEach((field) => {
        const colIndex = columnMapping[field.id];
        if (colIndex !== undefined && colIndex !== "") {
          const value = row[parseInt(colIndex)] || "";
          if (field.id === "regions") {
            // Split regions by comma or semicolon
            mapped.regions = value.split(/[,;]/).map((r) => r.trim()).filter(Boolean);
          } else if (field.id === "status") {
            const statusLower = value.toLowerCase();
            const matchedStatus = STATUS_OPTIONS.find(
              (s) => s.label.toLowerCase() === statusLower || s.value === statusLower
            );
            mapped.status = matchedStatus?.value || "warm";
          } else {
            (mapped as any)[field.id] = value;
          }
        }
      });

      // Validate required fields
      if (!mapped.name || mapped.name.trim() === "") {
        errors.push("Company Name is required");
      }

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
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Confirm & Import
  const handleImport = () => {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast.error("No rows selected for import");
      return;
    }

    setIsProcessing(true);

    // Simulate import delay
    setTimeout(() => {
      const newCompanies: Account[] = selectedRows.map((row, idx) => ({
        id: `imported-${Date.now()}-${idx}`,
        name: row.mapped.name || "Unknown Company",
        industry: row.mapped.industry || "Other",
        headquarters: row.mapped.headquarters,
        switchboard: row.mapped.switchboard,
        regions: row.mapped.regions || [],
        relationshipStatus: row.mapped.status || "warm",
        accountManager: row.mapped.owner
          ? { name: row.mapped.owner, title: "Account Manager" }
          : undefined,
        contacts: [],
        lastUpdated: new Date().toISOString(),
        engagementScore: 50,
        dataQuality: "partial" as const,
      }));

      onCompaniesImported(newCompanies);
      toast.success(`${newCompanies.length} companies imported successfully`);
      setIsProcessing(false);
      setStep("confirm");

      // Auto-close after short delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    }, 800);
  };

  const renderUploadStep = () => (
    <div className="space-y-6 py-4">
      {/* File Upload Zone */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Upload CSV / XLSX
        </h3>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center text-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Drop files here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">CSV</Badge>
              <Badge variant="outline" className="text-xs">XLSX</Badge>
            </div>
          </div>
        </div>
        {uploadedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {uploadedFile.name}
          </div>
        )}
      </div>

      {/* Paste Option */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" />
          Copy / Paste Table
        </h3>
        <Textarea
          placeholder="Paste your table data here (CSV format with headers)..."
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          className="min-h-[120px] font-mono text-sm"
        />
        {pastedData && (
          <Button
            size="sm"
            onClick={handlePasteData}
            className="mt-2"
          >
            Process Pasted Data
          </Button>
        )}
      </div>

      {/* OCR Option */}
      <div className="opacity-60">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <ScanLine className="h-4 w-4" />
          Scan Image / PDF (OCR)
          <Badge variant="secondary" className="text-xs">Best effort</Badge>
        </h3>
        <div className="border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
          <p>OCR import coming soon</p>
          <p className="text-xs mt-1">For best results, use CSV or XLSX</p>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 shrink-0" />
        <p>Map your columns to company fields. Required fields are marked with *</p>
      </div>

      <ScrollArea className="h-[350px]">
        <div className="space-y-3 pr-4">
          {COMPANY_FIELDS.map((field) => (
            <div key={field.id} className="flex items-center gap-4">
              <div className="w-40 shrink-0">
                <span className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </span>
              </div>
              <Select
                value={columnMapping[field.id] || "__skip__"}
                onValueChange={(value) => handleMappingChange(field.id, value === "__skip__" ? "" : value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__">— Skip —</SelectItem>
                  {rawHeaders.map((header, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="text-sm text-muted-foreground">
        <p>
          {rawRows.length} rows detected • {rawHeaders.length} columns
        </p>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4 py-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{validRowsCount}</p>
          <p className="text-xs text-muted-foreground">Valid</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{errorRowsCount}</p>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold">{selectedRowsCount}</p>
          <p className="text-xs text-muted-foreground">Selected</p>
        </div>
      </div>

      {/* Error download */}
      {errorRowsCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={downloadErrorCSV}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Error CSV
        </Button>
      )}

      {/* Preview Table */}
      <ScrollArea className="h-[280px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedRowsCount === validRowsCount && validRowsCount > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Headquarters</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedRows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(!row.isValid && "bg-destructive/5")}
              >
                <TableCell>
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={() => toggleRowSelection(row.id)}
                    disabled={!row.isValid}
                  />
                </TableCell>
                <TableCell>
                  {row.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {row.mapped.name || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.mapped.headquarters || "—"}
                </TableCell>
                <TableCell>
                  {row.mapped.industry && (
                    <Badge variant="secondary" className="text-xs">
                      {row.mapped.industry}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.errors.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {row.errors.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <ul className="text-xs">
                          {row.errors.map((err, i) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="py-8 flex flex-col items-center text-center gap-4">
      <div className="p-4 rounded-full bg-primary/10">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>
      <div>
        <p className="text-lg font-medium">Import Complete!</p>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedRowsCount} companies have been added
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Import Companies
            {step !== "upload" && (
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                {step === "mapping" && "Column Mapping"}
                {step === "preview" && "Preview"}
                {step === "confirm" && "Complete"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        {step !== "upload" && step !== "confirm" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(step === "mapping" && "text-primary font-medium")}>
              1. Map Columns
            </span>
            <ChevronRight className="h-3 w-3" />
            <span className={cn(step === "preview" && "text-primary font-medium")}>
              2. Preview
            </span>
            <ChevronRight className="h-3 w-3" />
            <span>3. Import</span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {isProcessing && step === "upload" ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing file...</p>
            </div>
          ) : (
            <>
              {step === "upload" && renderUploadStep()}
              {step === "mapping" && renderMappingStep()}
              {step === "preview" && renderPreviewStep()}
              {step === "confirm" && renderConfirmStep()}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview}>
                Preview Import
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedRowsCount === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {selectedRowsCount} Companies
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === "confirm" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
