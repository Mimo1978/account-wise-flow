import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Camera,
  Linkedin,
  Upload,
  Building2,
  Plus,
  Check,
} from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import type { OrgChartInputType } from "../OrgChartBuilderModal";

export interface CompanyDestination {
  type: "existing" | "new";
  companyId?: string;
  companyName?: string;
  country?: string;
}

interface OrgChartSourceStepProps {
  inputType: OrgChartInputType | null;
  onInputTypeChange: (type: OrgChartInputType) => void;
  rawData: string;
  onRawDataChange: (data: string) => void;
  uploadedFile: File | null;
  onFileChange: (file: File | null) => void;
  companyDestination: CompanyDestination;
  onCompanyDestinationChange: (dest: CompanyDestination) => void;
  existingCompanyId?: string;
  existingCompanyName?: string;
  companies?: Array<{ id: string; name: string }>;
}

const SOURCE_OPTIONS = [
  {
    id: "spreadsheet" as const,
    label: "Upload Spreadsheet",
    description: "CSV or Excel file with org data",
    icon: FileSpreadsheet,
    accepts: ".csv,.xlsx,.xls",
    disabled: false,
  },
  {
    id: "paste" as const,
    label: "Paste List",
    description: "Copy/paste table or text list",
    icon: ClipboardPaste,
    accepts: null,
    disabled: false,
  },
  {
    id: "ocr" as const,
    label: "Upload Image/PDF",
    description: "Screenshot OCR (best effort)",
    icon: Camera,
    accepts: "image/*,.pdf",
    disabled: false,
  },
  {
    id: "linkedin" as const,
    label: "LinkedIn",
    description: "Coming Soon",
    icon: Linkedin,
    accepts: null,
    disabled: true,
  },
];

type SourceOptionId = "spreadsheet" | "paste" | "ocr" | "linkedin";

export function OrgChartSourceStep({
  inputType,
  onInputTypeChange,
  rawData,
  onRawDataChange,
  uploadedFile,
  onFileChange,
  companyDestination,
  onCompanyDestinationChange,
  existingCompanyId,
  existingCompanyName,
  companies = [],
}: OrgChartSourceStepProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedSourceOption, setSelectedSourceOption] = useState<SourceOptionId | null>(
    inputType === "csv" || inputType === "xlsx" ? "spreadsheet" : inputType as SourceOptionId | null
  );

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [onInputTypeChange, onRawDataChange, onFileChange]
  );

  const handleFileUpload = (file: File) => {
    const fileName = file.name.toLowerCase();
    onFileChange(file);

    if (fileName.endsWith(".csv")) {
      onInputTypeChange("csv");
      const reader = new FileReader();
      reader.onload = (event) => {
        onRawDataChange((event.target?.result as string) || "");
      };
      reader.readAsText(file);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      onInputTypeChange("xlsx");
      onRawDataChange(`[File: ${file.name}]`);
    } else if (
      fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".pdf")
    ) {
      onInputTypeChange("ocr");
      onRawDataChange(`[File: ${file.name}]`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSourceOptionClick = (optionId: SourceOptionId) => {
    if (optionId === "linkedin") return;
    
    setSelectedSourceOption(optionId);
    onFileChange(null);
    onRawDataChange("");

    if (optionId === "paste") {
      onInputTypeChange("paste");
    } else if (optionId === "ocr") {
      onInputTypeChange("ocr");
    }
    // For spreadsheet, we'll set the actual type when file is uploaded
  };

  const handleDestinationTypeChange = (value: string) => {
    if (value === "new") {
      onCompanyDestinationChange({ type: "new", companyName: "", country: "" });
    } else if (value === "existing" && existingCompanyId) {
      onCompanyDestinationChange({
        type: "existing",
        companyId: existingCompanyId,
        companyName: existingCompanyName,
      });
    } else {
      onCompanyDestinationChange({ type: "existing" });
    }
  };

  const handleExistingCompanySelect = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    onCompanyDestinationChange({
      type: "existing",
      companyId,
      companyName: company?.name,
    });
  };

  return (
    <div className="space-y-6">
      {/* Company Destination Selector */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Import into</Label>
            </div>

            <Select
              value={companyDestination.type}
              onValueChange={handleDestinationTypeChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>Existing Company</span>
                  </div>
                </SelectItem>
                <SelectItem value="new">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Create New Company</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {companyDestination.type === "existing" && (
              <div className="space-y-2">
                {existingCompanyId ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">{existingCompanyName}</span>
                    <span className="text-xs text-muted-foreground">(preselected)</span>
                  </div>
                ) : (
                  <Select
                    value={companyDestination.companyId || ""}
                    onValueChange={handleExistingCompanySelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                      {companies.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No companies found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {companyDestination.type === "new" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="new-company-name" className="text-xs">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-company-name"
                    placeholder="Enter company name"
                    value={companyDestination.companyName || ""}
                    onChange={(e) =>
                      onCompanyDestinationChange({
                        ...companyDestination,
                        companyName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-company-country" className="text-xs">
                    Country / Region
                  </Label>
                  <Input
                    id="new-company-country"
                    placeholder="e.g., United Kingdom"
                    value={companyDestination.country || ""}
                    onChange={(e) =>
                      onCompanyDestinationChange({
                        ...companyDestination,
                        country: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Source Type Selection */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Select data source</Label>
        <div className="grid grid-cols-2 gap-3">
          {SOURCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedSourceOption === option.id;
            const isDisabled = option.disabled;

            const cardContent = (
              <button
                key={option.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSourceOptionClick(option.id)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all w-full",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-muted/50",
                  isDisabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-transparent"
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

            if (isDisabled) {
              return (
                <Tooltip key={option.id}>
                  <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p>
                      Planned integration — for now use screenshot OCR or CSV export
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return cardContent;
          })}
        </div>
      </div>

      {/* Input area based on selected type */}
      {selectedSourceOption && selectedSourceOption !== "linkedin" && (
        <div className="space-y-3">
          {selectedSourceOption === "spreadsheet" && (
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
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="font-medium">Drop your CSV or Excel file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
              {uploadedFile && (
                <div className="flex items-center gap-2 mt-3 px-3 py-1.5 bg-primary/10 rounded-full">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {uploadedFile.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {selectedSourceOption === "paste" && (
            <div className="space-y-2">
              <Label htmlFor="paste-data">Paste your data below</Label>
              <Textarea
                id="paste-data"
                placeholder={`Paste tab-separated or comma-separated data here...\n\nExample:\nName, Title, Department, Location\nJohn Smith, CEO, Executive, London\nJane Doe, CTO, Technology, New York\n\nOr paste a bulleted list:\n• John Smith - CEO\n• Jane Doe - CTO`}
                value={rawData}
                onChange={(e) => onRawDataChange(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports CSV, TSV, bulleted lists, or similar formats
              </p>
            </div>
          )}

          {selectedSourceOption === "ocr" && (
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
                PNG, JPG, or PDF of an org chart (best effort OCR)
              </p>
              {uploadedFile && (
                <div className="flex items-center gap-2 mt-3 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {uploadedFile.name}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}