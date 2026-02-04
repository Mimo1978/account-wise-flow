import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import type { OrgChartInputType, OrgChartRow } from "../OrgChartBuilderModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrgChartExtractStepProps {
  inputType: OrgChartInputType | null;
  rawData: string;
  extractedRows: OrgChartRow[];
  onExtractedRowsChange: (rows: OrgChartRow[]) => void;
  ocrText: string;
  onOcrTextChange: (text: string) => void;
  uploadedFile?: File | null;
}

interface ExtractedPerson {
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  company: string;
  confidence: "high" | "medium" | "low";
}

export function OrgChartExtractStep({
  inputType,
  rawData,
  extractedRows,
  onExtractedRowsChange,
  ocrText,
  onOcrTextChange,
  uploadedFile,
}: OrgChartExtractStepProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<string>("");

  // Auto-extract on mount if we have data
  useEffect(() => {
    if ((rawData || uploadedFile) && extractedRows.length === 0 && !isExtracting) {
      handleExtract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    setError(null);
    setExtractionProgress("");

    try {
      if (inputType === "ocr" && uploadedFile) {
        // Real OCR extraction via AI
        setExtractionProgress("Converting image...");
        const base64 = await fileToBase64(uploadedFile);
        
        setExtractionProgress("Running AI extraction...");
        const { data, error: fnError } = await supabase.functions.invoke("orgchart-extract", {
          body: {
            imageBase64: base64,
            mimeType: uploadedFile.type,
            extractionType: "ocr",
          },
        });

        if (fnError) {
          throw new Error(fnError.message || "OCR extraction failed");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Set OCR text if available
        if (data.ocrText) {
          onOcrTextChange(data.ocrText);
        }

        // Convert AI response to OrgChartRows
        const rows = convertToOrgChartRows(data.people || []);
        onExtractedRowsChange(rows);
        
        toast.success(`Extracted ${rows.length} people from image`);
      } else if (inputType === "paste") {
        // For paste, try CSV parsing first, then fallback to AI
        const csvRows = parseCsvData(rawData);
        
        if (csvRows.length > 0) {
          onExtractedRowsChange(csvRows);
        } else {
          // Use AI to parse unstructured text
          setExtractionProgress("Parsing with AI...");
          const { data, error: fnError } = await supabase.functions.invoke("orgchart-extract", {
            body: {
              rawText: rawData,
              extractionType: "text",
            },
          });

          if (fnError) {
            throw new Error(fnError.message || "Text parsing failed");
          }

          if (data.error) {
            throw new Error(data.error);
          }

          const rows = convertToOrgChartRows(data.people || []);
          onExtractedRowsChange(rows);
        }
      } else if (inputType === "csv") {
        // Parse CSV directly
        const rows = parseCsvData(rawData);
        onExtractedRowsChange(rows);
      } else if (inputType === "xlsx") {
        // For XLSX, we'd need a library - for now show guidance
        toast.info("Excel parsing requires additional setup. Please export to CSV.");
        setError("Please export your Excel file to CSV format and use 'Upload Spreadsheet' again.");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      const message = err instanceof Error ? err.message : "Failed to extract data";
      setError(message);
      toast.error(message);
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  };

  const convertToOrgChartRows = (people: ExtractedPerson[]): OrgChartRow[] => {
    const rows: OrgChartRow[] = people.map((person, idx) => ({
      id: String(idx + 1),
      full_name: normalizeText(person.full_name || ""),
      job_title: normalizeText(person.job_title || ""),
      department: normalizeText(person.department || ""),
      location: normalizeText(person.location || ""),
      company: normalizeText(person.company || ""),
      confidence: person.confidence || "medium",
      isDuplicate: false,
      selected: true,
    }));

    // Mark duplicates
    markDuplicates(rows);
    
    return rows;
  };

  const normalizeText = (text: string): string => {
    return text.trim().replace(/\s+/g, " ");
  };

  const markDuplicates = (rows: OrgChartRow[]) => {
    const nameCount = new Map<string, number>();
    rows.forEach((r) => {
      const key = r.full_name.toLowerCase();
      nameCount.set(key, (nameCount.get(key) || 0) + 1);
    });
    rows.forEach((r) => {
      if ((nameCount.get(r.full_name.toLowerCase()) || 0) > 1) {
        r.isDuplicate = true;
      }
    });
  };

  const parseCsvData = (data: string): OrgChartRow[] => {
    const lines = data.trim().split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes("\t") ? "\t" : ",";

    // Parse header
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

    // Check if first row looks like a header
    const hasHeader = headers.some(h => 
      h.includes("name") || h.includes("title") || h.includes("department") || 
      h.includes("role") || h.includes("position")
    );

    // Find column indices
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const titleIdx = headers.findIndex((h) => 
      h.includes("title") || h.includes("role") || h.includes("position")
    );
    const deptIdx = headers.findIndex((h) => h.includes("dept") || h.includes("department"));
    const locIdx = headers.findIndex((h) => 
      h.includes("loc") || h.includes("location") || h.includes("city") || h.includes("office")
    );
    const companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("org"));

    // Parse rows
    const rows: OrgChartRow[] = [];
    const startIdx = hasHeader ? 1 : 0;
    
    for (let i = startIdx; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => 
        v.trim().replace(/^["']|["']$/g, "")
      );
      
      // If no header detected, assume: Name, Title, Department, Location
      const row: OrgChartRow = {
        id: String(rows.length + 1),
        full_name: normalizeText(
          hasHeader && nameIdx >= 0 ? values[nameIdx] || "" : values[0] || ""
        ),
        job_title: normalizeText(
          hasHeader && titleIdx >= 0 ? values[titleIdx] || "" : values[1] || ""
        ),
        department: normalizeText(
          hasHeader && deptIdx >= 0 ? values[deptIdx] || "" : values[2] || ""
        ),
        location: normalizeText(
          hasHeader && locIdx >= 0 ? values[locIdx] || "" : values[3] || ""
        ),
        company: normalizeText(
          hasHeader && companyIdx >= 0 ? values[companyIdx] || "" : ""
        ),
        confidence: calculateConfidence(values, hasHeader ? nameIdx : 0, hasHeader ? titleIdx : 1),
        isDuplicate: false,
        selected: true,
      };

      if (row.full_name) {
        rows.push(row);
      }
    }

    // Mark duplicates
    markDuplicates(rows);

    return rows;
  };

  const calculateConfidence = (
    values: string[],
    nameIdx: number,
    titleIdx: number
  ): "high" | "medium" | "low" => {
    const hasName = nameIdx >= 0 && values[nameIdx]?.trim();
    const hasTitle = titleIdx >= 0 && values[titleIdx]?.trim();

    if (hasName && hasTitle) return "high";
    if (hasName || hasTitle) return "medium";
    return "low";
  };

  if (isExtracting) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          {inputType === "ocr" && (
            <Sparkles className="w-4 h-4 text-primary absolute -right-1 -top-1" />
          )}
        </div>
        <p className="font-medium mt-4">
          {inputType === "ocr" ? "Running AI-powered OCR..." : "Parsing data..."}
        </p>
        {extractionProgress && (
          <p className="text-sm text-muted-foreground mt-1">{extractionProgress}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
        <p className="font-medium text-destructive mb-2">Extraction Failed</p>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        <Button variant="outline" onClick={handleExtract} className="mt-4">
          Retry Extraction
        </Button>
      </div>
    );
  }

  const highConfidenceCount = extractedRows.filter(r => r.confidence === "high").length;
  const mediumConfidenceCount = extractedRows.filter(r => r.confidence === "medium").length;
  const lowConfidenceCount = extractedRows.filter(r => r.confidence === "low").length;
  const duplicateCount = extractedRows.filter(r => r.isDuplicate).length;

  return (
    <div className="space-y-4">
      {/* OCR Text Collapsible */}
      {inputType === "ocr" && ocrText && (
        <Collapsible open={showOcrText} onOpenChange={setShowOcrText}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
              {showOcrText ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <FileText className="w-4 h-4" />
              OCR Extracted Text
              <Badge variant="secondary" className="ml-auto">
                {ocrText.split("\n").filter(l => l.trim()).length} lines
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="p-4 bg-muted rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-[150px] overflow-y-auto">
              {ocrText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Extraction Summary */}
      {extractedRows.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            {highConfidenceCount > 0 && (
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                {highConfidenceCount} High
              </Badge>
            )}
            {mediumConfidenceCount > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-500/5">
                {mediumConfidenceCount} Med
              </Badge>
            )}
            {lowConfidenceCount > 0 && (
              <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                {lowConfidenceCount} Low
              </Badge>
            )}
          </div>
          {duplicateCount > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-600">{duplicateCount} potential duplicates</span>
            </div>
          )}
        </div>
      )}

      {/* Extraction Preview Table */}
      <div className="border rounded-lg">
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="font-medium">Extraction Preview</span>
            <Badge variant="secondary">{extractedRows.length} rows</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleExtract}>
            Re-extract
          </Button>
        </div>

        <ScrollArea className="h-[280px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[150px]">Job Title</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[100px]">Location</TableHead>
                <TableHead className="w-[90px]">Confidence</TableHead>
                <TableHead className="w-[80px]">Duplicate?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.confidence === "low" && "bg-destructive/5",
                    row.isDuplicate && "bg-amber-500/5"
                  )}
                >
                  <TableCell className="font-medium">{row.full_name || "—"}</TableCell>
                  <TableCell>{row.job_title || "—"}</TableCell>
                  <TableCell>{row.department || "—"}</TableCell>
                  <TableCell>{row.location || "—"}</TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={row.confidence} />
                  </TableCell>
                  <TableCell>
                    {row.isDuplicate ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {extractedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No data extracted. Please check your source data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">
        Review the extracted data above. Low confidence rows and duplicates may need manual review in the next step.
      </p>
    </div>
  );
}
