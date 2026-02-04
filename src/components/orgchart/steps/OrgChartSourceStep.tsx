import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, ClipboardPaste, Camera, Upload } from "lucide-react";
import type { OrgChartInputType } from "../OrgChartBuilderModal";

interface OrgChartSourceStepProps {
  inputType: OrgChartInputType | null;
  onInputTypeChange: (type: OrgChartInputType) => void;
  rawData: string;
  onRawDataChange: (data: string) => void;
}

const SOURCE_OPTIONS = [
  {
    id: "csv" as const,
    label: "CSV File",
    description: "Upload a .csv file with org data",
    icon: FileSpreadsheet,
  },
  {
    id: "xlsx" as const,
    label: "Excel File",
    description: "Upload a .xlsx spreadsheet",
    icon: FileSpreadsheet,
  },
  {
    id: "paste" as const,
    label: "Paste Data",
    description: "Paste tabular data from clipboard",
    icon: ClipboardPaste,
  },
  {
    id: "ocr" as const,
    label: "OCR / Image",
    description: "Scan an org chart image or PDF",
    icon: Camera,
  },
];

export function OrgChartSourceStep({
  inputType,
  onInputTypeChange,
  rawData,
  onRawDataChange,
}: OrgChartSourceStepProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".csv")) {
        onInputTypeChange("csv");
        // Read file content
        const reader = new FileReader();
        reader.onload = (event) => {
          onRawDataChange(event.target?.result as string || "");
        };
        reader.readAsText(file);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        onInputTypeChange("xlsx");
        // XLSX handling would be done in extract step
        onRawDataChange(`[File: ${file.name}]`);
      } else if (fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".pdf")) {
        onInputTypeChange("ocr");
        onRawDataChange(`[File: ${file.name}]`);
      }
    }
  }, [onInputTypeChange, onRawDataChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onRawDataChange(event.target?.result as string || "");
      };
      reader.readAsText(file);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      onRawDataChange(`[File: ${file.name}]`);
    } else if (inputType === "ocr") {
      onRawDataChange(`[File: ${file.name}]`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium mb-3 block">
          Select data source
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {SOURCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = inputType === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onInputTypeChange(option.id)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={cn("font-medium", isSelected && "text-primary")}>
                    {option.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input area based on selected type */}
      {inputType && (
        <div className="space-y-3">
          {(inputType === "csv" || inputType === "xlsx") && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <input
                type="file"
                accept={inputType === "csv" ? ".csv" : ".xlsx,.xls"}
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="font-medium">
                Drop your {inputType.toUpperCase()} file here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
              {rawData && rawData.startsWith("[File:") && (
                <p className="text-sm text-primary mt-2">{rawData}</p>
              )}
            </div>
          )}

          {inputType === "paste" && (
            <div className="space-y-2">
              <Label htmlFor="paste-data">Paste your data below</Label>
              <Textarea
                id="paste-data"
                placeholder="Paste tab-separated or comma-separated data here...&#10;&#10;Example:&#10;Name, Title, Department, Location&#10;John Smith, CEO, Executive, London&#10;Jane Doe, CTO, Technology, New York"
                value={rawData}
                onChange={(e) => onRawDataChange(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports CSV, TSV, or similar tabular formats
              </p>
            </div>
          )}

          {inputType === "ocr" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Camera className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="font-medium">Upload an image or PDF</p>
              <p className="text-sm text-muted-foreground">
                PNG, JPG, or PDF of an org chart
              </p>
              {rawData && rawData.startsWith("[File:") && (
                <p className="text-sm text-primary mt-2">{rawData}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
