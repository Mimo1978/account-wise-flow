/**
 * Seniority level inference from job titles
 * Used by the org chart to arrange contacts hierarchically
 */

export type SeniorityLevel = 'c-level' | 'vp-director' | 'head' | 'manager' | 'senior-ic' | 'ic';

export const SENIORITY_ORDER: Record<SeniorityLevel, number> = {
  'c-level': 0,
  'vp-director': 1,
  'head': 2,
  'manager': 3,
  'senior-ic': 4,
  'ic': 5,
};

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  'c-level': 'C-Suite',
  'vp-director': 'VP / Director',
  'head': 'Head of',
  'manager': 'Manager',
  'senior-ic': 'Senior',
  'ic': 'Individual Contributor',
};

const SENIORITY_PATTERNS: { level: SeniorityLevel; patterns: RegExp[] }[] = [
  {
    level: 'c-level',
    patterns: [
      /^(ceo|coo|cfo|cto|cio|ciso|cdo|cro|cco|chro|cmo|cso|cpo|clo|clao)$/i,
      /chief.*officer/i,
      /^president$/i,
      /managing.?director/i,
      /^founder/i,
      /^co-?founder/i,
      /^group.*director/i,
      /^executive.*director/i,
    ],
  },
  {
    level: 'vp-director',
    patterns: [
      /^vp\b/i,
      /vice.*president/i,
      /^svp\b/i,
      /^evp\b/i,
      /^director\b/i,
      /^global.*director/i,
      /^regional.*director/i,
      /^senior.*director/i,
      /^associate.*director/i,
      /^partner$/i,
      /^senior.*partner/i,
    ],
  },
  {
    level: 'head',
    patterns: [
      /^head\b/i,
      /^head.*of/i,
      /^global.*head/i,
      /^regional.*head/i,
    ],
  },
  {
    level: 'manager',
    patterns: [
      /manager/i,
      /^team.*lead/i,
      /^tech.*lead/i,
      /^lead\b/i,
      /^principal/i,
      /supervisor/i,
      /coordinator/i,
    ],
  },
  {
    level: 'senior-ic',
    patterns: [
      /^senior\b/i,
      /^sr\.?\b/i,
      /^staff\b/i,
      /^specialist/i,
    ],
  },
];

/**
 * Infer seniority level from a job title
 */
export function inferSeniority(title: string): SeniorityLevel {
  if (!title?.trim()) return 'ic';
  
  const normalized = title.trim();
  
  for (const { level, patterns } of SENIORITY_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return level;
      }
    }
  }
  
  return 'ic';
}

/**
 * Group and sort contacts by seniority and department for org chart layout.
 * Returns a hierarchy: C-level at top, then department groups with internal seniority.
 */
export interface OrgChartNode {
  contactId: string;
  name: string;
  title: string;
  department: string;
  seniority: SeniorityLevel;
  seniorityOrder: number;
}

export interface OrgChartLayout {
  /** Top-level executives (C-suite, MD) */
  executives: OrgChartNode[];
  /** Department groups, each sorted by seniority */
  departments: {
    name: string;
    nodes: OrgChartNode[];
  }[];
}

export function buildOrgChartLayout(contacts: { id: string; name: string; title: string; department: string }[]): OrgChartLayout {
  const nodes: OrgChartNode[] = contacts.map(c => {
    const seniority = inferSeniority(c.title);
    return {
      contactId: c.id,
      name: c.name,
      title: c.title,
      department: c.department || 'Other',
      seniority,
      seniorityOrder: SENIORITY_ORDER[seniority],
    };
  });

  // Executives are c-level regardless of department
  const executives = nodes
    .filter(n => n.seniority === 'c-level')
    .sort((a, b) => {
      // CEO first, then alphabetical
      const aIsCeo = /ceo|chief.*executive|managing.?director/i.test(a.title);
      const bIsCeo = /ceo|chief.*executive|managing.?director/i.test(b.title);
      if (aIsCeo && !bIsCeo) return -1;
      if (!aIsCeo && bIsCeo) return 1;
      return a.name.localeCompare(b.name);
    });

  // Non-executive contacts grouped by department
  const nonExec = nodes.filter(n => n.seniority !== 'c-level');
  const deptMap = new Map<string, OrgChartNode[]>();
  
  nonExec.forEach(n => {
    const dept = n.department;
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(n);
  });

  // Sort within each department by seniority
  const departments = Array.from(deptMap.entries())
    .map(([name, deptNodes]) => ({
      name,
      nodes: deptNodes.sort((a, b) => a.seniorityOrder - b.seniorityOrder || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { executives, departments };
}
