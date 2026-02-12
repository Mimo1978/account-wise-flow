import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, Users, Building2, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import type { OrgChartRow } from "../OrgChartBuilderModal";
import type { CompanyDestination } from "./OrgChartSourceStep";

interface OrgChartConfirmStepProps {
  extractedRows: OrgChartRow[];
  companyId?: string;
  companyName?: string;
  companyDestination?: CompanyDestination;
  onComplete: () => void;
  onImportComplete?: (importedContactIds: string[], companyId: string) => void;
}

type ImportStatus = "idle" | "importing" | "success" | "error";

export function OrgChartConfirmStep({
  extractedRows,
  companyId,
  companyName,
  companyDestination,
  onComplete,
  onImportComplete,
}: OrgChartConfirmStepProps) {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const handleImport = async () => {
    if (!currentWorkspace?.id) {
      toast.error("No workspace selected");
      return;
    }

    setStatus("importing");
    setProgress(0);
    setErrorMessage("");

    try {
      let targetCompanyId = companyId;

      // Create new company if needed
      if (companyDestination?.type === "new" && companyDestination.companyName) {
        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: companyDestination.companyName,
            headquarters: companyDestination.country || null,
            team_id: currentWorkspace.id,
          })
          .select("id")
          .single();

        if (companyError) {
          throw new Error(`Failed to create company: ${companyError.message}`);
        }
        targetCompanyId = newCompany.id;
      }

      if (!targetCompanyId) {
        throw new Error("No target company selected");
      }

      // Insert contacts in batches of 10
      const total = extractedRows.length;
      let imported = 0;
      const batchSize = 10;
      const allImportedIds: string[] = [];

      for (let i = 0; i < total; i += batchSize) {
        const batch = extractedRows.slice(i, i + batchSize);
        
        const contactsToInsert = batch.map((row) => ({
          name: row.full_name.trim(),
          title: row.job_title.trim() || null,
          department: row.department.trim() || null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          company_id: targetCompanyId,
          team_id: currentWorkspace.id,
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from("contacts")
          .insert(contactsToInsert)
          .select("id");

        if (insertError) {
          console.error("Batch insert error:", insertError);
          throw new Error(`Failed to import contacts: ${insertError.message}`);
        }

        if (insertedData) {
          allImportedIds.push(...insertedData.map((c) => c.id));
        }

        imported += batch.length;
        setImportedCount(imported);
        setProgress(Math.round((imported / total) * 100));
      }

      // Invalidate queries to refresh canvas and contact lists
      await queryClient.invalidateQueries({
        queryKey: ["canvas-company", targetCompanyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["canvas-companies"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["contacts"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["companies"],
      });

      setStatus("success");
      toast.success(`Successfully imported ${total} contacts`);

      // Auto-navigate to canvas with highlighted contacts
      if (onImportComplete && targetCompanyId) {
        setTimeout(() => {
          onImportComplete(allImportedIds, targetCompanyId);
        }, 800);
      }
    } catch (error) {
      console.error("Import error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      toast.error("Failed to import contacts. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
        <p className="text-muted-foreground mb-6">
          {importedCount} contacts have been added
          {companyName && ` to ${companyName}`}.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Navigating to canvas...
        </p>
      </div>
    );
  }

  if (status === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-semibold mb-2">Importing Contacts...</h3>
        <p className="text-muted-foreground mb-6">
          {importedCount} of {extractedRows.length} contacts imported
        </p>
        <div className="w-full max-w-xs">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground mt-2">
            {progress}%
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Import Failed</h3>
        <p className="text-muted-foreground mb-6">
          {errorMessage || "An error occurred while importing contacts. Please try again."}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleImport}>Retry Import</Button>
          <Button variant="outline" onClick={onComplete}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Idle state - confirmation
  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h3 className="text-lg font-semibold mb-2">Ready to Import</h3>
        <p className="text-muted-foreground">
          Review the summary below and click "Import" to add these contacts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{extractedRows.length}</p>
            <p className="text-sm text-muted-foreground">Contacts to import</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
            {companyDestination?.type === "new" ? (
              <Plus className="w-5 h-5 text-accent-foreground" />
            ) : (
              <Building2 className="w-5 h-5 text-accent-foreground" />
            )}
          </div>
          <div>
            <p className="text-lg font-semibold truncate">{companyName || "—"}</p>
            <p className="text-sm text-muted-foreground">
              {companyDestination?.type === "new" ? "New company" : "Target company"}
            </p>
          </div>
        </div>
      </div>

      {/* Contact List Preview */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-3">Contacts to be imported:</h4>
        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
          {extractedRows.slice(0, 20).map((row) => (
            <Badge key={row.id} variant="secondary" className="py-1">
              {row.full_name}
              {row.job_title && (
                <span className="text-muted-foreground ml-1">
                  ({row.job_title})
                </span>
              )}
            </Badge>
          ))}
          {extractedRows.length > 20 && (
            <Badge variant="outline" className="py-1">
              +{extractedRows.length - 20} more
            </Badge>
          )}
        </div>
      </div>

      {/* Import Button */}
      <div className="flex justify-center pt-4">
        <Button size="lg" onClick={handleImport} className="min-w-[200px]">
          Import {extractedRows.length} Contacts
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        This action will create new contacts and add them to the company record.
      </p>
    </div>
  );
}