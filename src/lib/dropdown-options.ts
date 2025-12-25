// Centralized dropdown options for forms and filters
// Reuse these across the application for consistency

export const departmentOptions = [
  // Executive / Leadership
  "Executive / Leadership",
  // Technology & Engineering
  "Technology / Engineering",
  "Data / Analytics",
  "Product",
  // Operations & Support
  "Operations",
  "Finance",
  "Risk",
  "Compliance",
  "Legal",
  "Procurement / Vendor Management",
  // Commercial
  "Sales",
  "Marketing",
  "Customer Success / Service",
  // Banking / Finance Specific
  "Trading",
  "Market Data",
  "Quant / Research",
  "Treasury",
  "Audit",
  "Security / InfoSec",
  // HR
  "HR",
] as const;

export const jobTitleOptions = {
  "C-Level / Exec": [
    "CEO",
    "COO",
    "CFO",
    "CTO",
    "CIO",
    "CISO",
    "CDO (Chief Data Officer)",
    "CRO (Chief Risk Officer)",
    "CCO (Chief Compliance Officer)",
    "CHRO",
  ],
  "EVP / SVP / VP / Director": [
    "EVP Technology",
    "SVP Engineering",
    "VP Engineering",
    "VP Product",
    "VP Data",
    "VP Risk",
    "VP Compliance",
    "VP Trading",
    "VP Operations",
    "VP Finance",
    "Director of Engineering",
    "Director of Data",
    "Director of Risk",
    "Director of Compliance",
    "Director of Procurement",
    "Director of IT",
    "Director of Market Data",
    "Director of Trading Systems",
  ],
  "Head / Lead": [
    "Head of Engineering",
    "Head of Platform",
    "Head of Architecture",
    "Head of Data Engineering",
    "Head of Analytics",
    "Head of Information Security",
    "Head of Infrastructure",
    "Head of Market Data",
  ],
  "Managers": [
    "Engineering Manager",
    "Product Manager",
    "Data Engineering Manager",
    "Risk Manager",
    "Compliance Manager",
    "Vendor Manager",
    "IT Manager",
    "Operations Manager",
  ],
  "Specialists / IC Roles": [
    "Enterprise Architect",
    "Solutions Architect",
    "Cloud Architect",
    "Data Architect",
    "Software Engineer",
    "Senior Software Engineer",
    "QA Engineer",
    "DevOps Engineer",
    "SRE",
    "Data Engineer",
    "Analytics Engineer",
    "Data Scientist",
    "Business Analyst",
    "Product Owner",
    "Risk Analyst",
    "Compliance Analyst",
    "Legal Counsel",
    "Procurement Specialist",
    "Vendor Manager",
    "Market Data Analyst",
    "Trading Support Analyst",
  ],
} as const;

// Flat list of all job titles for simple dropdowns
export const jobTitleOptionsFlat = Object.values(jobTitleOptions).flat();

export const seniorityOptions = [
  { value: "executive", label: "Executive" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "mid", label: "Mid-Level" },
  { value: "junior", label: "Junior" },
] as const;

// Type exports for type safety
export type DepartmentOption = typeof departmentOptions[number];
export type SeniorityOption = typeof seniorityOptions[number]["value"];
