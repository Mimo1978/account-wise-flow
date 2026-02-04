import { useState, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Upload,
  Building2,
  Plus,
  Check,
  FileSpreadsheet,
  Camera,
  Search,
  MapPin,
  Globe,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrgChartProviders } from "@/hooks/use-orgchart-providers";
import type { OrgChartInputType } from "../OrgChartBuilderModal";
import type { OrgChartProviderId } from "@/lib/orgchart-providers";

export interface CompanyDestination {
  type: "existing" | "new";
  companyId?: string;
  companyName?: string;
  country?: string;
  city?: string;
}

interface CompanyWithDetails {
  id: string;
  name: string;
  industry?: string | null;
  size?: string | null;
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
  companies?: CompanyWithDetails[];
  detectedCompanyName?: string; // For smart prefill from OCR
}

// Common countries for quick selection
const COUNTRY_OPTIONS = [
  "United Kingdom",
  "United States",
  "Germany",
  "France",
  "Singapore",
  "Hong Kong",
  "Japan",
  "Australia",
  "Netherlands",
  "Switzerland",
];

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
  detectedCompanyName,
}: OrgChartSourceStepProps) {
  const providers = useOrgChartProviders();
  const [dragActive, setDragActive] = useState(false);
  const [selectedSourceOption, setSelectedSourceOption] = useState<OrgChartProviderId | null>(
    inputType === "csv" || inputType === "xlsx" ? "spreadsheet" : inputType as OrgChartProviderId | null
  );
  const [companySearch, setCompanySearch] = useState("");
  const [destinationMode, setDestinationMode] = useState<"existing" | "new">(
    companyDestination.type
  );

  // Get the currently selected provider
  const selectedProvider = providers.find((p) => p.id === selectedSourceOption);

  // Filter companies based on search
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) {
      return companies.slice(0, 10); // Show first 10 by default
    }
    const query = companySearch.toLowerCase();
    return companies
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [companies, companySearch]);

  // Check if detected company name matches any existing company
  const suggestedCompany = useMemo(() => {
    if (!detectedCompanyName) return null;
    const detected = detectedCompanyName.toLowerCase();
    return companies.find((c) => c.name.toLowerCase().includes(detected));
  }, [detectedCompanyName, companies]);

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

  const handleSourceOptionClick = (optionId: OrgChartProviderId) => {
    const provider = providers.find((p) => p.id === optionId);
    if (!provider?.enabled) return;
    
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

  const handleDestinationModeChange = (mode: "existing" | "new") => {
    setDestinationMode(mode);
    if (mode === "new") {
      onCompanyDestinationChange({ 
        type: "new", 
        companyName: detectedCompanyName || "", 
        country: "", 
        city: "" 
      });
    } else if (mode === "existing" && existingCompanyId) {
      onCompanyDestinationChange({
        type: "existing",
        companyId: existingCompanyId,
        companyName: existingCompanyName,
      });
    } else {
      onCompanyDestinationChange({ type: "existing" });
    }
  };

  const handleExistingCompanySelect = (company: CompanyWithDetails) => {
    onCompanyDestinationChange({
      type: "existing",
      companyId: company.id,
      companyName: company.name,
    });
    setCompanySearch("");
  };

  const handleClearSelection = () => {
    onCompanyDestinationChange({ type: "existing" });
    setCompanySearch("");
  };

  const handleAcceptSuggestion = () => {
    if (suggestedCompany) {
      handleExistingCompanySelect(suggestedCompany);
    }
  };

  const handleCreateFromSuggestion = () => {
    if (detectedCompanyName) {
      setDestinationMode("new");
      onCompanyDestinationChange({
        type: "new",
        companyName: detectedCompanyName,
        country: "",
        city: "",
      });
    }
  };

  const isDestinationValid = 
    (companyDestination.type === "existing" && companyDestination.companyId) ||
    (companyDestination.type === "new" && companyDestination.companyName?.trim() && companyDestination.country?.trim());

  return (
    <div className="space-y-6">
      {/* Company Destination Panel - Always Visible at Top */}
      <Card className={cn(
        "border-2 transition-colors",
        isDestinationValid ? "border-primary/50 bg-primary/5" : "border-dashed border-warning/50"
      )}>
        <CardContent className="pt-4 pb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <Label className="text-base font-semibold">Destination Company</Label>
                {!isDestinationValid && (
                  <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                    Required
                  </Badge>
                )}
              </div>
              {isDestinationValid && (
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  <Check className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              )}
            </div>

            {/* Smart Prefill Suggestion */}
            {detectedCompanyName && !companyDestination.companyId && destinationMode === "existing" && (
              <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Detected: <span className="font-medium">"{detectedCompanyName}"</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {suggestedCompany ? (
                    <Button size="sm" onClick={handleAcceptSuggestion} className="gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      Use "{suggestedCompany.name}"
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={handleCreateFromSuggestion} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Create New
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Mode Tabs */}
            <div className="flex gap-2">
              <Button
                variant={destinationMode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDestinationModeChange("existing")}
                className="flex-1"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Existing Company
              </Button>
              <Button
                variant={destinationMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => handleDestinationModeChange("new")}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>

            {/* Existing Company Selector */}
            {destinationMode === "existing" && (
              <div className="space-y-3">
                {existingCompanyId ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">{existingCompanyName}</span>
                    <span className="text-xs text-muted-foreground">(preselected)</span>
                  </div>
                ) : companyDestination.companyId ? (
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="font-medium">{companyDestination.companyName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearSelection}
                      className="h-7 w-7 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search companies..."
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-[160px] border rounded-lg">
                      {filteredCompanies.length > 0 ? (
                        <div className="p-1">
                          {filteredCompanies.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              onClick={() => handleExistingCompanySelect(company)}
                              className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-muted/80 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{company.name}</p>
                                  {company.industry && (
                                    <p className="text-xs text-muted-foreground">{company.industry}</p>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                          <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {companySearch ? "No companies found" : "No companies available"}
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleDestinationModeChange("new")}
                            className="mt-1"
                          >
                            Create a new company
                          </Button>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Create New Company Form */}
            {destinationMode === "new" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <div className="space-y-1.5">
                  <Label htmlFor="new-company-name" className="text-xs font-medium">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-company-name"
                    placeholder="Enter company name"
                    value={companyDestination.companyName || ""}
                    onChange={(e) =>
                      onCompanyDestinationChange({
                        ...companyDestination,
                        type: "new",
                        companyName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-company-country" className="text-xs font-medium">
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        Country / Region <span className="text-destructive">*</span>
                      </div>
                    </Label>
                    <Input
                      id="new-company-country"
                      placeholder="e.g., United Kingdom"
                      value={companyDestination.country || ""}
                      onChange={(e) =>
                        onCompanyDestinationChange({
                          ...companyDestination,
                          type: "new",
                          country: e.target.value,
                        })
                      }
                      list="country-options"
                    />
                    <datalist id="country-options">
                      {COUNTRY_OPTIONS.map((country) => (
                        <option key={country} value={country} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-company-city" className="text-xs font-medium">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        City (optional)
                      </div>
                    </Label>
                    <Input
                      id="new-company-city"
                      placeholder="e.g., London"
                      value={companyDestination.city || ""}
                      onChange={(e) =>
                        onCompanyDestinationChange({
                          ...companyDestination,
                          type: "new",
                          city: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Company will be created when you complete the import.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Source Type Selection - Using Provider Pattern */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Select data source</Label>
        <div className="grid grid-cols-2 gap-3">
          {providers.map((provider) => {
            const Icon = provider.icon;
            const isSelected = selectedSourceOption === provider.id;
            const isDisabled = !provider.enabled;

            const cardContent = (
              <button
                key={provider.id}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSourceOptionClick(provider.id as OrgChartProviderId)}
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
                    {provider.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                  {provider.authRequired && (
                    <span className="text-xs text-muted-foreground/70">(requires auth)</span>
                  )}
                </div>
              </button>
            );

            if (isDisabled && provider.disabledTooltip) {
              return (
                <Tooltip key={provider.id}>
                  <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]">
                    <p>{provider.disabledTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return cardContent;
          })}
        </div>
      </div>

      {/* Input area based on selected provider */}
      {selectedProvider && selectedProvider.enabled && (
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

      {/* Destination Validation Notice */}
      {!isDestinationValid && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
          <Building2 className="h-4 w-4 text-warning" />
          <span className="text-warning-foreground">
            Please select or create a destination company before proceeding.
          </span>
        </div>
      )}
    </div>
  );
}
