import { useMemo } from "react";
import {
  FileSpreadsheet,
  ClipboardPaste,
  Camera,
  Linkedin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type {
  OrgChartSourceProvider,
  OrgChartParseResult,
  OrgChartProviderId,
} from "@/lib/orgchart-providers";

/**
 * Parse CSV/TSV text into structured rows
 */
function parseCsvText(text: string): OrgChartParseResult {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) {
    return { success: false, rows: [], error: "No data to parse" };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  // Parse header row
  const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) =>
    ["name", "full_name", "fullname", "employee"].includes(h)
  );
  const titleIdx = headers.findIndex((h) =>
    ["title", "job_title", "jobtitle", "role", "position"].includes(h)
  );
  const deptIdx = headers.findIndex((h) =>
    ["department", "dept", "division", "team"].includes(h)
  );
  const locIdx = headers.findIndex((h) =>
    ["location", "office", "city", "region"].includes(h)
  );
  const companyIdx = headers.findIndex((h) =>
    ["company", "organization", "org"].includes(h)
  );

  // Skip header if we found column mappings
  const dataLines = nameIdx >= 0 ? lines.slice(1) : lines;

  const rows = dataLines.map((line) => {
    const cols = line.split(delimiter).map((c) => c.trim());
    return {
      full_name: nameIdx >= 0 ? cols[nameIdx] || "" : cols[0] || "",
      job_title: titleIdx >= 0 ? cols[titleIdx] || "" : cols[1] || "",
      department: deptIdx >= 0 ? cols[deptIdx] || "" : cols[2] || "",
      location: locIdx >= 0 ? cols[locIdx] || "" : cols[3] || "",
      company: companyIdx >= 0 ? cols[companyIdx] || "" : "",
    };
  }).filter((r) => r.full_name);

  return { success: true, rows, rawText: text };
}

/**
 * Parse pasted text - handles CSV, TSV, and bulleted lists
 */
async function parsePastedText(
  text: string,
  context?: { supabase?: any }
): Promise<OrgChartParseResult> {
  // Try structured parsing first
  const csvResult = parseCsvText(text);
  if (csvResult.rows.length > 0 && csvResult.rows.some((r) => r.job_title)) {
    return csvResult;
  }

  // If structured parsing fails or looks incomplete, use AI
  if (context?.supabase) {
    try {
      const { data, error } = await context.supabase.functions.invoke(
        "orgchart-extract",
        {
          body: { rawText: text, extractionType: "text" },
        }
      );

      if (error) throw error;
      return {
        success: true,
        rows: data.people || [],
        rawText: text,
      };
    } catch (err) {
      console.error("AI parsing failed:", err);
      // Fall back to basic parsing
      return csvResult;
    }
  }

  return csvResult;
}

/**
 * Parse image/PDF via OCR
 */
async function parseOcrFile(
  file: File,
  context?: { supabase?: any }
): Promise<OrgChartParseResult> {
  if (!context?.supabase) {
    return { success: false, rows: [], error: "Supabase client required" };
  }

  // Convert file to base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );

  try {
    const { data, error } = await context.supabase.functions.invoke(
      "orgchart-extract",
      {
        body: {
          imageBase64: base64,
          mimeType: file.type,
          extractionType: "ocr",
        },
      }
    );

    if (error) throw error;

    return {
      success: true,
      rows: data.people || [],
      rawText: data.ocrText || "",
    };
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return {
      success: false,
      rows: [],
      error: err instanceof Error ? err.message : "OCR extraction failed",
    };
  }
}

/**
 * Parse spreadsheet file (CSV/XLSX)
 */
async function parseSpreadsheetFile(file: File): Promise<OrgChartParseResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    // TODO: Implement XLSX parsing with SheetJS
    return {
      success: false,
      rows: [],
      error: "Excel file support coming soon. Please export as CSV.",
    };
  }

  return { success: false, rows: [], error: "Unsupported file type" };
}

/**
 * LinkedIn placeholder - not implemented
 */
async function parseLinkedIn(): Promise<OrgChartParseResult> {
  return {
    success: false,
    rows: [],
    error: "LinkedIn integration is not available yet",
  };
}

/**
 * Hook that provides all registered org chart source providers
 */
export function useOrgChartProviders(): OrgChartSourceProvider[] {
  return useMemo(() => {
    const providers: OrgChartSourceProvider[] = [
      {
        id: "spreadsheet",
        label: "Upload Spreadsheet",
        description: "CSV or Excel file with org data",
        icon: FileSpreadsheet,
        enabled: true,
        accepts: ".csv,.xlsx,.xls",
        authRequired: false,
        parse: async (input) => {
          if (typeof input === "string") {
            return { success: false, rows: [], error: "File required" };
          }
          return parseSpreadsheetFile(input);
        },
      },
      {
        id: "paste",
        label: "Paste List",
        description: "Copy/paste table or text list",
        icon: ClipboardPaste,
        enabled: true,
        accepts: null,
        authRequired: false,
        parse: async (input, context) => {
          if (typeof input !== "string") {
            return { success: false, rows: [], error: "Text required" };
          }
          return parsePastedText(input, { supabase: context?.supabase || supabase });
        },
      },
      {
        id: "ocr",
        label: "Upload Image/PDF",
        description: "Screenshot OCR (best effort)",
        icon: Camera,
        enabled: true,
        accepts: "image/*,.pdf",
        authRequired: false,
        parse: async (input, context) => {
          if (typeof input === "string") {
            return { success: false, rows: [], error: "File required" };
          }
          return parseOcrFile(input, { supabase: context?.supabase || supabase });
        },
      },
      {
        id: "linkedin",
        label: "LinkedIn",
        description: "Coming Soon",
        icon: Linkedin,
        enabled: false,
        accepts: null,
        authRequired: true,
        disabledTooltip:
          "LinkedIn integration is planned — for now use screenshot OCR or CSV export from LinkedIn Sales Navigator",
        parse: parseLinkedIn,
      },
    ];

    return providers;
  }, []);
}

/**
 * Get a specific provider by ID
 */
export function useOrgChartProvider(
  id: OrgChartProviderId
): OrgChartSourceProvider | undefined {
  const providers = useOrgChartProviders();
  return providers.find((p) => p.id === id);
}
