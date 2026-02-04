import { useState } from "react";
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
import { OrgChartSourceStep } from "./steps/OrgChartSourceStep";
import { OrgChartExtractStep } from "./steps/OrgChartExtractStep";
import { OrgChartReviewStep } from "./steps/OrgChartReviewStep";
import { OrgChartPreviewStep } from "./steps/OrgChartPreviewStep";
import { OrgChartConfirmStep } from "./steps/OrgChartConfirmStep";

export type OrgChartInputType = "csv" | "xlsx" | "paste" | "ocr";

export interface OrgChartRow {
  id: string;
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  company: string;
  confidence: "high" | "medium" | "low";
  isDuplicate: boolean;
  selected: boolean;
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
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "source":
        return inputType !== null && (inputType === "paste" ? rawData.trim().length > 0 : true);
      case "extract":
        return extractedRows.length > 0;
      case "review":
        return extractedRows.some((r) => r.selected);
      case "preview":
        return true;
      case "confirm":
        return true;
      default:
        return false;
    }
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
            companyName={companyName}
          />
        );
      case "confirm":
        return (
          <OrgChartConfirmStep
            extractedRows={extractedRows.filter((r) => r.selected)}
            companyId={companyId}
            companyName={companyName}
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
            {companyName && (
              <span className="text-muted-foreground font-normal">
                — {companyName}
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
    </Dialog>
  );
}
