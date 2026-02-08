/**
 * Org Chart Source Provider Interface
 * 
 * This interface defines the contract for data sources that can feed
 * into the Org Chart Builder wizard. Each provider handles input parsing
 * and returns structured row data for the extraction step.
 */

import type { LucideIcon } from "lucide-react";

export interface OrgChartExtractedRow {
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  company: string;
}

export interface OrgChartParseResult {
  success: boolean;
  rows: OrgChartExtractedRow[];
  rawText?: string; // For OCR, contains the extracted text
  error?: string;
}

export interface OrgChartSourceProvider {
  /** Unique identifier for this provider */
  id: string;
  
  /** Display label shown in the UI */
  label: string;
  
  /** Short description of the provider */
  description: string;
  
  /** Icon component to display */
  icon: LucideIcon;
  
  /** Whether this provider is currently enabled */
  enabled: boolean;
  
  /** File types accepted (null for non-file inputs like paste) */
  accepts: string | null;
  
  /** Whether this provider requires authentication */
  authRequired?: boolean;
  
  /** Tooltip text when disabled (e.g., "Coming Soon") */
  disabledTooltip?: string;
  
  /**
   * Parse the input and return structured rows.
   * For file-based providers, input is the File object.
   * For text-based providers (paste), input is the raw string.
   * 
   * This is an async function as some providers may need to call
   * external services (e.g., OCR API, future LinkedIn API).
   */
  parse: (input: File | string, context?: OrgChartParseContext) => Promise<OrgChartParseResult>;
}

export interface OrgChartParseContext {
  /** Supabase client for API calls */
  supabase?: any;
  
  /** Target company context if known */
  companyId?: string;
  companyName?: string;
}

/**
 * Provider Registry Type
 * Maps provider IDs to their implementations
 */
export type OrgChartProviderRegistry = Record<string, OrgChartSourceProvider>;

/**
 * Provider IDs as a union type for type safety
 */
export type OrgChartProviderId = "spreadsheet" | "paste" | "ocr" | "linkedin" | "web-research";
