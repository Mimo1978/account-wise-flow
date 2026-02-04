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
import { Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ConfidenceBadge } from "@/components/import/ConfidenceBadge";
import type { OrgChartInputType, OrgChartRow } from "../OrgChartBuilderModal";
import { cn } from "@/lib/utils";

interface OrgChartExtractStepProps {
  inputType: OrgChartInputType | null;
  rawData: string;
  extractedRows: OrgChartRow[];
  onExtractedRowsChange: (rows: OrgChartRow[]) => void;
  ocrText: string;
  onOcrTextChange: (text: string) => void;
}

export function OrgChartExtractStep({
  inputType,
  rawData,
  extractedRows,
  onExtractedRowsChange,
  ocrText,
  onOcrTextChange,
}: OrgChartExtractStepProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-extract on mount if we have data
  useEffect(() => {
    if (rawData && extractedRows.length === 0 && !isExtracting) {
      handleExtract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExtract = async () => {
    setIsExtracting(true);
    setError(null);

    try {
      // Simulate extraction delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (inputType === "ocr") {
        // Simulate OCR extraction
        const simulatedOcrText = `CEO - John Smith
CTO - Jane Doe, Technology
CFO - Bob Johnson, Finance
VP Engineering - Alice Brown, Technology, San Francisco
VP Sales - Charlie Wilson, Sales, New York
Director HR - Diana Prince, Human Resources, London`;
        onOcrTextChange(simulatedOcrText);

        // Parse OCR text into structured rows
        const rows = parseOcrText(simulatedOcrText);
        onExtractedRowsChange(rows);
      } else if (inputType === "paste" || inputType === "csv") {
        // Parse CSV/paste data
        const rows = parseCsvData(rawData);
        onExtractedRowsChange(rows);
      } else if (inputType === "xlsx") {
        // Simulate XLSX parsing
        const mockRows: OrgChartRow[] = [
          { id: "1", full_name: "John Smith", job_title: "CEO", department: "Executive", location: "London", company: "", confidence: "high", isDuplicate: false, selected: true },
          { id: "2", full_name: "Jane Doe", job_title: "CTO", department: "Technology", location: "London", company: "", confidence: "high", isDuplicate: false, selected: true },
          { id: "3", full_name: "Bob Johnson", job_title: "CFO", department: "Finance", location: "New York", company: "", confidence: "medium", isDuplicate: false, selected: true },
        ];
        onExtractedRowsChange(mockRows);
      }
    } catch (err) {
      setError("Failed to extract data. Please check your input format.");
    } finally {
      setIsExtracting(false);
    }
  };

  const parseCsvData = (data: string): OrgChartRow[] => {
    const lines = data.trim().split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes("\t") ? "\t" : ",";

    // Parse header
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

    // Find column indices
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const titleIdx = headers.findIndex((h) => h.includes("title") || h.includes("role") || h.includes("position"));
    const deptIdx = headers.findIndex((h) => h.includes("dept") || h.includes("department"));
    const locIdx = headers.findIndex((h) => h.includes("loc") || h.includes("location") || h.includes("city"));
    const companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("org"));

    // Parse rows
    const rows: OrgChartRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ""));
      
      const row: OrgChartRow = {
        id: String(i),
        full_name: nameIdx >= 0 ? values[nameIdx] || "" : values[0] || "",
        job_title: titleIdx >= 0 ? values[titleIdx] || "" : values[1] || "",
        department: deptIdx >= 0 ? values[deptIdx] || "" : "",
        location: locIdx >= 0 ? values[locIdx] || "" : "",
        company: companyIdx >= 0 ? values[companyIdx] || "" : "",
        confidence: calculateConfidence(values, nameIdx, titleIdx),
        isDuplicate: false,
        selected: true,
      };

      if (row.full_name) {
        rows.push(row);
      }
    }

    // Check for duplicates
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

    return rows;
  };

  const parseOcrText = (text: string): OrgChartRow[] => {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    const rows: OrgChartRow[] = [];

    lines.forEach((line, idx) => {
      // Try to parse various formats
      // Format: "Title - Name" or "Name - Title, Department"
      const parts = line.split(/[-–,]/).map((p) => p.trim());
      
      let name = "";
      let title = "";
      let department = "";
      let location = "";

      if (parts.length >= 2) {
        // Check if first part looks like a title
        if (parts[0].match(/^(CEO|CTO|CFO|VP|Director|Manager|Head|President|Chief)/i)) {
          title = parts[0];
          name = parts[1];
          department = parts[2] || "";
          location = parts[3] || "";
        } else {
          name = parts[0];
          title = parts[1];
          department = parts[2] || "";
          location = parts[3] || "";
        }
      } else {
        name = parts[0];
      }

      if (name) {
        rows.push({
          id: String(idx + 1),
          full_name: name,
          job_title: title,
          department,
          location,
          company: "",
          confidence: title && name ? "medium" : "low",
          isDuplicate: false,
          selected: true,
        });
      }
    });

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
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="font-medium">
          {inputType === "ocr" ? "Running OCR analysis..." : "Parsing data..."}
        </p>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
        <p className="font-medium text-destructive">{error}</p>
        <Button variant="outline" onClick={handleExtract} className="mt-4">
          Retry Extraction
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OCR Text Collapsible */}
      {inputType === "ocr" && ocrText && (
        <Collapsible open={showOcrText} onOpenChange={setShowOcrText}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 mb-2">
              {showOcrText ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              OCR Text
              <Badge variant="secondary" className="ml-1">
                {ocrText.split("\n").length} lines
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="p-4 bg-muted rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
              {ocrText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
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

        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[150px]">Job Title</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[100px]">Location</TableHead>
                <TableHead className="w-[80px]">Confidence</TableHead>
                <TableHead className="w-[80px]">Duplicate?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractedRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.confidence === "low" && "bg-amber-500/5",
                    row.isDuplicate && "bg-orange-500/5"
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
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
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
        Review the extracted data above. Rows with low confidence may need manual review in the next step.
      </p>
    </div>
  );
}
