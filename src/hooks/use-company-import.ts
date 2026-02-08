import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
  CompanyReviewItem,
  DuplicateSuggestion,
  ReviewDecision,
} from "@/components/import/CompanyReviewStep";
import {
  findDuplicates,
  validateCompanyRecord,
  detectCompanyNameColumn,
  ColumnDetectionResult,
} from "@/lib/import-utils";
import { ParsedRow } from "@/components/import/ImportCenterTypes";

interface ExistingCompany {
  id: string;
  name: string;
  headquarters?: string;
  industry?: string;
}

export function useCompanyImport() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [existingCompanies, setExistingCompanies] = useState<ExistingCompany[]>([]);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  /**
   * Detect company name column with smart logic
   */
  const detectColumn = useCallback(
    (headers: string[], sampleRows: string[][]): ColumnDetectionResult => {
      return detectCompanyNameColumn(headers, sampleRows);
    },
    []
  );

  /**
   * Fetch existing companies for duplicate checking
   */
  const fetchExistingCompanies = useCallback(async () => {
    if (!currentWorkspace?.id) return [];

    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, industry")
        .eq("team_id", currentWorkspace.id);

      if (error) throw error;

      const companies = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        headquarters: undefined, // Not in DB yet
        industry: c.industry || undefined,
      }));

      setExistingCompanies(companies);
      return companies;
    } catch (error) {
      console.error("Error fetching existing companies:", error);
      return [];
    }
  }, [currentWorkspace?.id]);

  /**
   * Build review items from parsed rows with duplicate detection
   */
  const buildReviewItems = useCallback(
    async (parsedRows: ParsedRow[]): Promise<CompanyReviewItem[]> => {
      setIsLoadingDuplicates(true);

      try {
        const companies = await fetchExistingCompanies();

        const reviewItems: CompanyReviewItem[] = parsedRows.map((row) => {
          const name = row.mapped.name || "";
          const validation = validateCompanyRecord(row.mapped);

          // Find duplicates
          const duplicates = findDuplicates(name, companies, 0.6);
          const duplicateSuggestions: DuplicateSuggestion[] = duplicates.map((d) => ({
            id: d.id,
            name: d.name,
            headquarters: d.headquarters,
            industry: d.industry,
            similarity: d.similarity,
          }));

          // Default decision: "create" if valid, "skip" if invalid
          let decision: ReviewDecision = validation.isValid ? "create" : "skip";

          return {
            id: row.id,
            name,
            headquarters: row.mapped.headquarters || undefined,
            industry: row.mapped.industry || undefined,
            regions: row.mapped.regions || undefined,
            switchboard: row.mapped.switchboard || undefined,
            notes: row.mapped.notes || undefined,
            rawData: row.mapped,
            decision,
            duplicateSuggestions,
            isValid: validation.isValid,
            errors: validation.errors,
          };
        });

        return reviewItems;
      } finally {
        setIsLoadingDuplicates(false);
      }
    },
    [fetchExistingCompanies]
  );

  /**
   * Save reviewed companies to database
   */
  const saveCompanies = useCallback(
    async (
      reviewItems: CompanyReviewItem[]
    ): Promise<{ created: number; matched: number; skipped: number; errors: string[] }> => {
      if (!currentWorkspace?.id) {
        return { created: 0, matched: 0, skipped: 0, errors: ["No workspace selected"] };
      }

      const toCreate = reviewItems.filter(
        (item) => item.decision === "create" && item.isValid
      );
      const toMatch = reviewItems.filter(
        (item) => item.decision === "match" && item.matchedCompanyId && item.isValid
      );
      const skipped = reviewItems.filter((item) => item.decision === "skip").length;

      setIsSaving(true);
      setSaveProgress(0);

      const errors: string[] = [];
      let created = 0;
      let matched = 0;

      try {
        // Create new companies
        if (toCreate.length > 0) {
          const insertData = toCreate.map((item) => ({
            name: item.name,
            industry: item.industry || null,
            team_id: currentWorkspace.id,
          }));

          const { data, error } = await supabase
            .from("companies")
            .insert(insertData)
            .select("id");

          if (error) {
            errors.push(`Failed to create companies: ${error.message}`);
          } else {
            created = data?.length || 0;
          }

          setSaveProgress(50);
        }

        // For matched companies, we could update them here if needed
        // For now, we just count them as successfully matched
        matched = toMatch.length;

        setSaveProgress(100);

        // Invalidate queries to refresh the companies list
        await queryClient.invalidateQueries({
          queryKey: ["companies", currentWorkspace.id],
        });

        return { created, matched, skipped, errors };
      } catch (err) {
        console.error("Error saving companies:", err);
        errors.push(err instanceof Error ? err.message : "Unknown error");
        return { created, matched, skipped, errors };
      } finally {
        setIsSaving(false);
        setSaveProgress(0);
      }
    },
    [currentWorkspace?.id, queryClient]
  );

  return {
    detectColumn,
    buildReviewItems,
    saveCompanies,
    existingCompanies,
    isLoadingDuplicates,
    isSaving,
    saveProgress,
  };
}
