/**
 * Import Utilities - Column Detection and Duplicate Matching
 */

// Company name detection patterns (ordered by confidence)
const COMPANY_NAME_PATTERNS = [
  /^company$/i,
  /^company[\s_-]?name$/i,
  /^organisation$/i,
  /^organization$/i,
  /^org$/i,
  /^client$/i,
  /^client[\s_-]?name$/i,
  /^account$/i,
  /^account[\s_-]?name$/i,
  /^business$/i,
  /^business[\s_-]?name$/i,
  /^firm$/i,
  /^firm[\s_-]?name$/i,
  /^employer$/i,
  /^vendor$/i,
  /^partner$/i,
];

// Patterns that suggest a column is NOT a company name
const NON_COMPANY_PATTERNS = [
  /email/i,
  /phone/i,
  /tel/i,
  /address/i,
  /city/i,
  /country/i,
  /region/i,
  /state/i,
  /zip/i,
  /postal/i,
  /status/i,
  /owner/i,
  /manager/i,
  /date/i,
  /created/i,
  /updated/i,
  /id$/i,
  /^id$/i,
  /notes/i,
  /comment/i,
  /description/i,
  /industry/i,
  /sector/i,
  /type/i,
  /size/i,
  /revenue/i,
  /employees/i,
  /website/i,
  /url/i,
  /linkedin/i,
];

export interface ColumnDetectionResult {
  columnIndex: number | null;
  confidence: "high" | "medium" | "low";
  matchedPattern?: string;
  alternatives: { index: number; header: string; confidence: string }[];
  needsConfirmation: boolean;
}

/**
 * Detect which column contains company names
 */
export function detectCompanyNameColumn(
  headers: string[],
  sampleRows: string[][] = []
): ColumnDetectionResult {
  const candidates: { index: number; confidence: number; pattern: string }[] = [];

  // Step 1: Check headers against known patterns
  headers.forEach((header, index) => {
    const headerClean = header.trim().toLowerCase();
    
    // Skip columns that look like non-company fields
    if (NON_COMPANY_PATTERNS.some((p) => p.test(headerClean))) {
      return;
    }

    // Check against company name patterns
    for (let i = 0; i < COMPANY_NAME_PATTERNS.length; i++) {
      if (COMPANY_NAME_PATTERNS[i].test(headerClean)) {
        // Higher patterns = higher confidence
        const confidence = 1 - (i / COMPANY_NAME_PATTERNS.length) * 0.3;
        candidates.push({ index, confidence, pattern: headerClean });
        return;
      }
    }

    // Partial match (contains "company" or "name")
    if (headerClean.includes("company") || headerClean.includes("organisation")) {
      candidates.push({ index, confidence: 0.6, pattern: headerClean });
    }
  });

  // Step 2: If no header matches, check first column values
  if (candidates.length === 0 && sampleRows.length > 0) {
    // Check if first column looks like company names (not numbers, emails, etc.)
    const firstColValues = sampleRows.map((row) => row[0] || "").filter(Boolean);
    if (firstColValues.length > 0 && looksLikeCompanyNames(firstColValues)) {
      candidates.push({ index: 0, confidence: 0.4, pattern: "first-column-fallback" });
    }

    // Also check second column as fallback
    const secondColValues = sampleRows.map((row) => row[1] || "").filter(Boolean);
    if (secondColValues.length > 0 && looksLikeCompanyNames(secondColValues)) {
      candidates.push({ index: 1, confidence: 0.35, pattern: "second-column-fallback" });
    }
  }

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Determine result
  if (candidates.length === 0) {
    return {
      columnIndex: null,
      confidence: "low",
      alternatives: [],
      needsConfirmation: true,
    };
  }

  const best = candidates[0];
  const alternatives = candidates.slice(1, 4).map((c) => ({
    index: c.index,
    header: headers[c.index] || `Column ${c.index + 1}`,
    confidence: c.confidence > 0.7 ? "high" : c.confidence > 0.4 ? "medium" : "low",
  }));

  // Need confirmation if:
  // - Low confidence
  // - Multiple high-confidence candidates
  const needsConfirmation =
    best.confidence < 0.7 ||
    (candidates.length > 1 && candidates[1].confidence > 0.6);

  return {
    columnIndex: best.index,
    confidence: best.confidence > 0.7 ? "high" : best.confidence > 0.4 ? "medium" : "low",
    matchedPattern: best.pattern,
    alternatives,
    needsConfirmation,
  };
}

/**
 * Check if values look like company names
 */
function looksLikeCompanyNames(values: string[]): boolean {
  let companyLike = 0;
  let notCompanyLike = 0;

  for (const value of values) {
    const v = value.trim();
    
    // Definitely not company names
    if (
      /^[\d.,]+$/.test(v) || // Just numbers
      /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v) || // Email
      /^https?:\/\//i.test(v) || // URL
      /^\+?[\d\s()-]{7,}$/.test(v) || // Phone
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v) // Date
    ) {
      notCompanyLike++;
      continue;
    }

    // Company name indicators
    if (
      /\b(Inc|LLC|Ltd|Corp|Co|Company|Group|Holdings|Partners|Services|Solutions|Technologies|Industries|Enterprises|International)\b/i.test(v) ||
      (v.length > 2 && v.length < 100 && /^[A-Z]/.test(v)) // Starts with capital, reasonable length
    ) {
      companyLike++;
    }
  }

  return companyLike > notCompanyLike;
}

/**
 * Calculate fuzzy similarity between two strings
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Levenshtein distance based similarity
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - distance / maxLength;
}

/**
 * Normalize company name for comparison
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|group|holdings|limited|plc)\b\.?/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find duplicate companies in existing database
 */
export function findDuplicates(
  newCompanyName: string,
  existingCompanies: { id: string; name: string; headquarters?: string; industry?: string }[],
  threshold: number = 0.7
): { id: string; name: string; headquarters?: string; industry?: string; similarity: number }[] {
  if (!newCompanyName.trim()) return [];

  const matches: { id: string; name: string; headquarters?: string; industry?: string; similarity: number }[] = [];

  for (const company of existingCompanies) {
    const similarity = calculateSimilarity(newCompanyName, company.name);
    if (similarity >= threshold) {
      matches.push({ ...company, similarity });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, 5); // Return top 5 matches
}

/**
 * Validate a company record before saving
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCompanyRecord(record: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: Company name
  if (!record.name || typeof record.name !== "string" || record.name.trim() === "") {
    errors.push("Company Name is required");
  } else if (record.name.trim().length < 2) {
    errors.push("Company Name must be at least 2 characters");
  }

  // Optional field warnings
  if (record.switchboard && !/^[\d\s()+.-]+$/.test(record.switchboard)) {
    warnings.push("Switchboard may not be a valid phone number");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
