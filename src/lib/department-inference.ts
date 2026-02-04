/**
 * Smart department inference from job titles
 * Maps common job title patterns to likely departments
 */

import { departmentOptions } from "./dropdown-options";

interface TitlePattern {
  patterns: RegExp[];
  department: string;
}

const TITLE_TO_DEPARTMENT_MAPPINGS: TitlePattern[] = [
  // Executive / Leadership
  {
    patterns: [
      /^(ceo|coo|cfo|cto|cio|ciso|cdo|cro|cco|chro)$/i,
      /chief.*officer/i,
      /president/i,
      /founder/i,
      /managing.?director/i,
    ],
    department: "Executive / Leadership",
  },
  // Technology / Engineering
  {
    patterns: [
      /engineer/i,
      /developer/i,
      /architect/i,
      /devops/i,
      /sre/i,
      /software/i,
      /platform/i,
      /infrastructure/i,
      /tech.*lead/i,
      /cto/i,
      /vp.*engineering/i,
      /head.*engineering/i,
      /director.*engineering/i,
      /director.*technology/i,
    ],
    department: "Technology / Engineering",
  },
  // Data / Analytics
  {
    patterns: [
      /data.*engineer/i,
      /data.*scientist/i,
      /data.*analyst/i,
      /analytics/i,
      /machine.*learning/i,
      /ml.*engineer/i,
      /ai.*engineer/i,
      /cdo/i,
      /head.*data/i,
      /vp.*data/i,
      /director.*data/i,
      /bi.*analyst/i,
      /business.*intelligence/i,
    ],
    department: "Data / Analytics",
  },
  // Product
  {
    patterns: [
      /product.*manager/i,
      /product.*owner/i,
      /product.*director/i,
      /head.*product/i,
      /vp.*product/i,
      /cpo/i,
      /ux/i,
      /ui.*designer/i,
      /product.*designer/i,
      /design.*lead/i,
    ],
    department: "Product",
  },
  // Finance
  {
    patterns: [
      /cfo/i,
      /finance/i,
      /accountant/i,
      /controller/i,
      /fp&a/i,
      /financial.*analyst/i,
      /head.*finance/i,
      /vp.*finance/i,
      /treasury/i,
    ],
    department: "Finance",
  },
  // Treasury (more specific than Finance)
  {
    patterns: [
      /treasury/i,
      /treasurer/i,
      /cash.*management/i,
    ],
    department: "Treasury",
  },
  // Risk
  {
    patterns: [
      /cro/i,
      /risk/i,
      /head.*risk/i,
      /vp.*risk/i,
      /director.*risk/i,
    ],
    department: "Risk",
  },
  // Compliance
  {
    patterns: [
      /cco/i,
      /compliance/i,
      /head.*compliance/i,
      /vp.*compliance/i,
      /director.*compliance/i,
      /regulatory/i,
    ],
    department: "Compliance",
  },
  // Legal
  {
    patterns: [
      /legal/i,
      /counsel/i,
      /attorney/i,
      /lawyer/i,
      /general.*counsel/i,
      /clao/i,
    ],
    department: "Legal",
  },
  // Security / InfoSec
  {
    patterns: [
      /ciso/i,
      /security/i,
      /infosec/i,
      /cyber/i,
      /head.*security/i,
      /information.*security/i,
      /soc.*analyst/i,
    ],
    department: "Security / InfoSec",
  },
  // Operations
  {
    patterns: [
      /coo/i,
      /operations/i,
      /ops.*manager/i,
      /head.*operations/i,
      /vp.*operations/i,
      /director.*operations/i,
      /facilities/i,
    ],
    department: "Operations",
  },
  // Sales
  {
    patterns: [
      /sales/i,
      /account.*executive/i,
      /business.*development/i,
      /bdr/i,
      /sdr/i,
      /head.*sales/i,
      /vp.*sales/i,
      /cso/i,
      /revenue/i,
    ],
    department: "Sales",
  },
  // Marketing
  {
    patterns: [
      /marketing/i,
      /cmo/i,
      /head.*marketing/i,
      /vp.*marketing/i,
      /brand/i,
      /communications/i,
      /content/i,
      /growth/i,
    ],
    department: "Marketing",
  },
  // Customer Success / Service
  {
    patterns: [
      /customer.*success/i,
      /customer.*service/i,
      /support/i,
      /client.*success/i,
      /client.*services/i,
      /head.*customer/i,
      /vp.*customer/i,
    ],
    department: "Customer Success / Service",
  },
  // HR
  {
    patterns: [
      /chro/i,
      /hr/i,
      /human.*resources/i,
      /people.*ops/i,
      /people.*operations/i,
      /talent.*acquisition/i,
      /recruiter/i,
      /recruiting/i,
      /head.*people/i,
      /vp.*people/i,
      /director.*hr/i,
    ],
    department: "HR",
  },
  // Trading
  {
    patterns: [
      /trader/i,
      /trading/i,
      /desk/i,
      /execution/i,
      /head.*trading/i,
    ],
    department: "Trading",
  },
  // Market Data
  {
    patterns: [
      /market.*data/i,
      /data.*vendor/i,
      /head.*market.*data/i,
    ],
    department: "Market Data",
  },
  // Quant / Research
  {
    patterns: [
      /quant/i,
      /quantitative/i,
      /research/i,
      /strategist/i,
    ],
    department: "Quant / Research",
  },
  // Audit
  {
    patterns: [
      /audit/i,
      /internal.*audit/i,
      /head.*audit/i,
    ],
    department: "Audit",
  },
  // Procurement / Vendor Management
  {
    patterns: [
      /procurement/i,
      /vendor.*management/i,
      /vendor.*manager/i,
      /sourcing/i,
      /purchasing/i,
      /supply.*chain/i,
      /head.*procurement/i,
    ],
    department: "Procurement / Vendor Management",
  },
];

/**
 * Infer department from job title using pattern matching
 * Returns the suggested department or null if no match found
 */
export function inferDepartmentFromTitle(jobTitle: string): string | null {
  if (!jobTitle?.trim()) return null;
  
  const normalizedTitle = jobTitle.trim().toLowerCase();
  
  for (const mapping of TITLE_TO_DEPARTMENT_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(normalizedTitle)) {
        // Verify the department exists in our options
        if (departmentOptions.includes(mapping.department as any)) {
          return mapping.department;
        }
      }
    }
  }
  
  return null;
}

/**
 * Get multiple possible departments for a job title, ranked by relevance
 */
export function getDepartmentSuggestions(jobTitle: string): string[] {
  if (!jobTitle?.trim()) return [];
  
  const normalizedTitle = jobTitle.trim().toLowerCase();
  const matches: string[] = [];
  
  for (const mapping of TITLE_TO_DEPARTMENT_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (pattern.test(normalizedTitle)) {
        if (!matches.includes(mapping.department)) {
          matches.push(mapping.department);
        }
        break; // Only count each mapping once
      }
    }
  }
  
  return matches;
}

/**
 * Apply smart department inference to rows that are missing departments
 * Returns the count of rows that were auto-filled
 */
export function applySmartDepartments<T extends { job_title: string; department: string }>(
  rows: T[]
): { updatedRows: T[]; filledCount: number } {
  let filledCount = 0;
  
  const updatedRows = rows.map((row) => {
    // Only infer if department is empty but job title exists
    if (!row.department?.trim() && row.job_title?.trim()) {
      const inferred = inferDepartmentFromTitle(row.job_title);
      if (inferred) {
        filledCount++;
        return { ...row, department: inferred };
      }
    }
    return row;
  });
  
  return { updatedRows, filledCount };
}
