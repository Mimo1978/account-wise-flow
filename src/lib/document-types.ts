// Unified document types for Talent, Contacts, and Companies

export type EntityType = 'candidate' | 'contact' | 'company';

export type DocumentType = 
  | 'cv' 
  | 'job_spec' 
  | 'proposal' 
  | 'bid' 
  | 'contract' 
  | 'nda' 
  | 'sow' 
  | 'cover_letter' 
  | 'other';

export interface Document {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  name: string;
  fileType: string;
  documentType: DocumentType;
  storagePath: string;
  fileSizeBytes: number;
  rawText?: string | null;
  textExtractedAt?: string | null;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface DocumentRow {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  name: string;
  file_type: string;
  document_type: string;
  storage_path: string;
  file_size_bytes: number;
  raw_text?: string | null;
  text_extracted_at?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export const documentTypeConfig: Record<DocumentType, { 
  label: string; 
  color: string;
  applicableTo: EntityType[];
}> = {
  cv: { 
    label: "CV / Resume", 
    color: "text-blue-500",
    applicableTo: ['candidate']
  },
  cover_letter: { 
    label: "Cover Letter", 
    color: "text-indigo-500",
    applicableTo: ['candidate']
  },
  job_spec: { 
    label: "Job Spec", 
    color: "text-purple-500",
    applicableTo: ['contact', 'company']
  },
  proposal: { 
    label: "Proposal", 
    color: "text-green-500",
    applicableTo: ['contact', 'company']
  },
  bid: { 
    label: "Bid", 
    color: "text-amber-500",
    applicableTo: ['contact', 'company']
  },
  contract: { 
    label: "Contract", 
    color: "text-red-500",
    applicableTo: ['candidate', 'contact', 'company']
  },
  nda: { 
    label: "NDA", 
    color: "text-pink-500",
    applicableTo: ['candidate', 'contact', 'company']
  },
  sow: { 
    label: "Statement of Work", 
    color: "text-cyan-500",
    applicableTo: ['contact', 'company']
  },
  other: { 
    label: "Other", 
    color: "text-muted-foreground",
    applicableTo: ['candidate', 'contact', 'company']
  },
};

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ACCEPTED_FILE_EXTENSIONS = [".pdf", ".doc", ".docx"];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function mapDocumentRow(row: DocumentRow): Document {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    name: row.name,
    fileType: row.file_type,
    documentType: row.document_type as DocumentType,
    storagePath: row.storage_path,
    fileSizeBytes: row.file_size_bytes,
    rawText: row.raw_text,
    textExtractedAt: row.text_extracted_at,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

export function getDocumentTypesForEntity(entityType: EntityType): DocumentType[] {
  return Object.entries(documentTypeConfig)
    .filter(([_, config]) => config.applicableTo.includes(entityType))
    .map(([type]) => type as DocumentType);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
