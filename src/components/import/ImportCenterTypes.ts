// Import Center - Shared Types

export type EntityType = "companies" | "contacts" | "talent";

export type ImportStep = "upload" | "ocr-upload" | "mapping" | "preview" | "review" | "confirm";
export type ImportMethod = "file" | "paste" | "ocr";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface FieldSchema {
  id: string;
  label: string;
  required: boolean;
  type?: "text" | "select" | "multiselect" | "phone" | "email";
}

export interface ParsedRow {
  id: string;
  original: Record<string, string>;
  mapped: Record<string, any>;
  errors: string[];
  isValid: boolean;
  selected: boolean;
  confidence?: ConfidenceLevel; // OCR confidence level
  rawText?: string; // Original OCR text snippet
}

export interface OCRExtractedRow {
  fields: Record<string, string>;
  confidence: ConfidenceLevel;
  rawText?: string;
}

export interface OCRResult {
  success: boolean;
  rows: OCRExtractedRow[];
  headers: string[];
  totalRows: number;
  warnings?: string[];
}

export interface ImportCenterConfig {
  entityType: EntityType;
  title: string;
  allowedFileTypes: string[];
  fieldSchema: FieldSchema[];
  autoMappingRules?: Record<string, string[]>; // field id -> possible header matches
}

// Field schemas for each entity type
export const companyFieldSchema: FieldSchema[] = [
  { id: "name", label: "Company Name", required: true },
  { id: "headquarters", label: "Headquarters", required: false },
  { id: "switchboard", label: "Switchboard", required: false, type: "phone" },
  { id: "industry", label: "Industry", required: false },
  { id: "regions", label: "Regions", required: false, type: "multiselect" },
  { id: "status", label: "Status", required: false, type: "select" },
  { id: "owner", label: "Owner", required: false },
  { id: "notes", label: "Notes", required: false },
];

export const contactFieldSchema: FieldSchema[] = [
  { id: "name", label: "Name", required: true },
  { id: "email", label: "Email", required: false, type: "email" },
  { id: "phone", label: "Phone", required: false, type: "phone" },
  { id: "company", label: "Company", required: false },
  { id: "title", label: "Job Title", required: false },
  { id: "department", label: "Department", required: false },
  { id: "seniority", label: "Seniority", required: false, type: "select" },
  { id: "status", label: "Status", required: false, type: "select" },
  { id: "notes", label: "Notes", required: false },
];

export const talentFieldSchema: FieldSchema[] = [
  { id: "name", label: "Name", required: true },
  { id: "email", label: "Email", required: false, type: "email" },
  { id: "phone", label: "Phone", required: false, type: "phone" },
  { id: "location", label: "Location", required: false },
  { id: "roleType", label: "Role / Title", required: false },
  { id: "seniority", label: "Seniority", required: false, type: "select" },
  { id: "skills", label: "Skills", required: false, type: "multiselect" },
  { id: "availability", label: "Availability", required: false, type: "select" },
  { id: "rate", label: "Rate", required: false },
  { id: "linkedIn", label: "LinkedIn", required: false },
  { id: "notes", label: "Notes", required: false },
];

// Auto-mapping rules for common header variations
export const companyAutoMappingRules: Record<string, string[]> = {
  name: ["company", "company name", "organization", "org", "name", "business"],
  headquarters: ["hq", "headquarters", "location", "city", "address", "office"],
  switchboard: ["phone", "tel", "telephone", "switchboard", "main phone"],
  industry: ["industry", "sector", "vertical", "business type"],
  regions: ["region", "regions", "country", "countries", "territory", "territories"],
  status: ["status", "relationship", "account status"],
  owner: ["owner", "account owner", "manager", "account manager", "assigned to"],
  notes: ["notes", "comments", "description", "remarks"],
};

export const contactAutoMappingRules: Record<string, string[]> = {
  name: ["name", "full name", "contact name", "person"],
  email: ["email", "e-mail", "email address", "work email"],
  phone: ["phone", "mobile", "tel", "telephone", "cell", "work phone"],
  company: ["company", "organization", "employer", "firm"],
  title: ["title", "job title", "position", "role"],
  department: ["department", "dept", "division", "team"],
  seniority: ["seniority", "level", "grade"],
  status: ["status", "relationship status", "contact status"],
  notes: ["notes", "comments", "description"],
};

export const talentAutoMappingRules: Record<string, string[]> = {
  name: ["name", "full name", "candidate name", "person"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "mobile", "tel", "telephone", "cell"],
  location: ["location", "city", "address", "based in"],
  roleType: ["role", "role type", "title", "job title", "position", "specialty"],
  seniority: ["seniority", "level", "experience level", "grade"],
  skills: ["skills", "skill", "technologies", "tech stack", "competencies"],
  availability: ["availability", "status", "available"],
  rate: ["rate", "day rate", "salary", "compensation"],
  linkedIn: ["linkedin", "linkedin url", "profile", "social"],
  notes: ["notes", "comments", "summary"],
};

export function getFieldSchemaForEntity(entityType: EntityType): FieldSchema[] {
  switch (entityType) {
    case "companies":
      return companyFieldSchema;
    case "contacts":
      return contactFieldSchema;
    case "talent":
      return talentFieldSchema;
    default:
      return [];
  }
}

export function getAutoMappingRulesForEntity(entityType: EntityType): Record<string, string[]> {
  switch (entityType) {
    case "companies":
      return companyAutoMappingRules;
    case "contacts":
      return contactAutoMappingRules;
    case "talent":
      return talentAutoMappingRules;
    default:
      return {};
  }
}

export function getEntityLabel(entityType: EntityType, plural: boolean = false): string {
  switch (entityType) {
    case "companies":
      return plural ? "Companies" : "Company";
    case "contacts":
      return plural ? "Contacts" : "Contact";
    case "talent":
      return plural ? "Candidates" : "Candidate";
    default:
      return plural ? "Records" : "Record";
  }
}
