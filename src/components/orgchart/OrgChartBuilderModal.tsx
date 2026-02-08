import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, FileUp, Scan, Eye, ListChecks, GitBranch } from "lucide-react";
import { OrgChartSourceStep, CompanyDestination } from "./steps/OrgChartSourceStep";
import { OrgChartExtractStep } from "./steps/OrgChartExtractStep";
import { OrgChartReviewStep } from "./steps/OrgChartReviewStep";
import { OrgChartPreviewStep } from "./steps/OrgChartPreviewStep";
import { OrgChartConfirmStep } from "./steps/OrgChartConfirmStep";
import { WebResearchWizard } from "./WebResearchWizard";
import { supabase } from "@/integrations/supabase/client";
import type { LabeledPhone } from "@/lib/phone-utils";

export type OrgChartInputType = "csv" | "xlsx" | "paste" | "ocr";

export type DuplicateAction = "merge" | "create_new" | "skip" | null;

export interface OrgChartRow {
  id: string;
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  company: string;
  email?: string;
  emailConfidence?: "high" | "medium" | "low";
  phone?: string; // Primary phone for display
  phones?: LabeledPhone[]; // All phones with labels
  confidence: "high" | "medium" | "low";
  isDuplicate: boolean;
  duplicateContactId?: string; // ID of existing contact if duplicate
  duplicateContactName?: string; // Name of existing contact for display
  duplicateAction: DuplicateAction;
  selected: boolean;
  validationErrors: string[]; // List of validation error messages
}

interface OrgChartBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  companyName?: string;
}

const STEPS = [
  { id: "source", label: "Source", icon: FileUp },
  { id: "extract", label: "Extract", icon: Scan },
  { id: "review", label: "Review & Map", icon: ListChecks },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "confirm", label: "Confirm", icon: GitBranch },
] as const;

type StepId = typeof STEPS[number]["id"];

export function OrgChartBuilderModal({
  open,
  onOpenChange,
  companyId,
  companyName,
}: OrgChartBuilderModalProps) {
  const [currentStep, setCurrentStep] = useState<StepId>("source");
  const [inputType, setInputType] = useState<OrgChartInputType | null>(null);
  const [rawData, setRawData] = useState<string>("");
  const [extractedRows, setExtractedRows] = useState<OrgChartRow[]>([]);
  const [ocrText, setOcrText] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string; industry?: string | null; size?: string | null }>>([]);
  const [companyDestination, setCompanyDestination] = useState<CompanyDestination>(() => {
    if (companyId) {
      return { type: "existing", companyId, companyName };
    }
    return { type: "existing" };
  });
  const [detectedCompanyName, setDetectedCompanyName] = useState<string | undefined>();
  const [showWebResearchWizard, setShowWebResearchWizard] = useState(false);

  // Fetch companies list
  useEffect(() => {
    async function fetchCompanies() {
      const { data } = await supabase
        .from("companies")
        .select("id, name, industry, size")
        .order("name");
      if (data) {
        setCompanies(data);
      }
    }
    if (open && !companyId) {
      fetchCompanies();
    }
  }, [open, companyId]);

  // Try to detect company name from file name or raw data
  useEffect(() => {
    if (uploadedFile) {
      // Extract potential company name from file name
      const fileName = uploadedFile.name.replace(/\.(csv|xlsx|xls|pdf|png|jpg|jpeg)$/i, "");
      const cleanedName = fileName
        .replace(/[-_]/g, " ")
        .replace(/org\s*chart/i, "")
        .replace(/contacts?/i, "")
        .replace(/import/i, "")
        .trim();
      
      if (cleanedName.length > 2 && cleanedName.split(" ").length <= 5) {
        setDetectedCompanyName(cleanedName);
      } else {
        setDetectedCompanyName(undefined);
      }
    } else {
      setDetectedCompanyName(undefined);
    }
  }, [uploadedFile]);

  // Reset destination when modal opens with a company context
  useEffect(() => {
    if (open && companyId) {
      setCompanyDestination({ type: "existing", companyId, companyName });
    }
  }, [open, companyId, companyName]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleClose = () => {
    // Reset state
    setCurrentStep("source");
    setInputType(null);
    setRawData("");
    setExtractedRows([]);
    setOcrText("");
    setUploadedFile(null);
    setCompanyDestination(companyId ? { type: "existing", companyId, companyName } : { type: "existing" });
    onOpenChange(false);
  };

  const isCompanyDestinationValid = () => {
    if (companyDestination.type === "existing") {
      return !!companyDestination.companyId;
    }
    // For new companies, require both name and country
    return !!companyDestination.companyName?.trim() && !!companyDestination.country?.trim();
  };

  const canProceed = () => {
    switch (currentStep) {
      case "source":
        // Must have company destination AND input selected with data
        if (!isCompanyDestinationValid()) return false;
        if (!inputType) return false;
        if (inputType === "paste") return rawData.trim().length > 0;
        if (inputType === "csv" || inputType === "xlsx" || inputType === "ocr") return !!uploadedFile || rawData.length > 0;
        return false;
      case "extract":
        return extractedRows.length > 0;
      case "review":
        // Only rows that pass validation and are selected can proceed
        const selectedRows = extractedRows.filter((r) => r.selected);
        if (selectedRows.length === 0) return false;
        // All selected rows must have no validation errors
        const allValid = selectedRows.every((r) => r.validationErrors.length === 0);
        // All duplicates must have an action selected
        const allDuplicatesHandled = selectedRows
          .filter((r) => r.isDuplicate)
          .every((r) => r.duplicateAction !== null);
        return allValid && allDuplicatesHandled;
      case "preview":
        return true;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  // Get the effective company name for display
  const effectiveCompanyName = companyDestination.type === "existing" 
    ? companyDestination.companyName 
    : companyDestination.companyName;
  
  const effectiveCompanyId = companyDestination.type === "existing"
    ? companyDestination.companyId
    : undefined;

  // Handle web research results import
  const handleWebResearchImport = (rows: OrgChartRow[]) => {
    setExtractedRows(rows);
    setCurrentStep("review");
    setShowWebResearchWizard(false);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "source":
        return (
          <OrgChartSourceStep
            inputType={inputType}
            onInputTypeChange={setInputType}
            rawData={rawData}
            onRawDataChange={setRawData}
            uploadedFile={uploadedFile}
            onFileChange={setUploadedFile}
            companyDestination={companyDestination}
            onCompanyDestinationChange={setCompanyDestination}
            existingCompanyId={companyId}
            existingCompanyName={companyName}
            companies={companies}
            detectedCompanyName={detectedCompanyName}
            onWebResearchClick={() => setShowWebResearchWizard(true)}
          />
        );
      case "extract":
        return (
          <OrgChartExtractStep
            inputType={inputType}
            rawData={rawData}
            extractedRows={extractedRows}
            onExtractedRowsChange={setExtractedRows}
            ocrText={ocrText}
            onOcrTextChange={setOcrText}
            uploadedFile={uploadedFile}
          />
        );
      case "review":
        return (
          <OrgChartReviewStep
            extractedRows={extractedRows}
            onExtractedRowsChange={setExtractedRows}
          />
        );
      case "preview":
        return (
          <OrgChartPreviewStep
            extractedRows={extractedRows.filter((r) => r.selected)}
            companyName={effectiveCompanyName}
          />
        );
      case "confirm":
        return (
          <OrgChartConfirmStep
            extractedRows={extractedRows.filter((r) => r.selected)}
            companyId={effectiveCompanyId}
            companyName={effectiveCompanyName}
            companyDestination={companyDestination}
            onComplete={handleClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Org Chart Builder
            {(effectiveCompanyName || companyName) && (
              <span className="text-muted-foreground font-normal">
                — {effectiveCompanyName || companyName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Import and build an organizational chart from various sources
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 py-4 border-b border-border">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = step.id === currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary bg-primary/10",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent && "text-primary",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2",
                      index < currentStepIndex ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            {currentStep !== "confirm" && (
              <Button onClick={handleNext} disabled={!canProceed()}>
                {currentStep === "preview" ? "Confirm Import" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Web Research Wizard - separate modal */}
      {effectiveCompanyId && effectiveCompanyName && (
        <WebResearchWizard
          open={showWebResearchWizard}
          onOpenChange={setShowWebResearchWizard}
          companyId={effectiveCompanyId}
          companyName={effectiveCompanyName}
          onImportContacts={handleWebResearchImport}
        />
      )}
    </Dialog>
  );
}
