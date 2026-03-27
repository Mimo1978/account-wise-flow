// Types for Talent Documents (CV Vault)

export type DocKind = 'cv' | 'cover_letter' | 'certification' | 'other';
export type ParseStatus = 'pending' | 'parsed' | 'failed';
export type PdfConversionStatus = 'pending' | 'converting' | 'done' | 'failed' | 'not_needed';

export interface TalentDocument {
  id: string;
  workspaceId: string;
  talentId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string | null;
  uploadedAt: string;
  docKind: DocKind;
  parsedText: string | null;
  parseStatus: ParseStatus;
  textHash: string | null;
  pdfStoragePath: string | null;
  pdfConversionStatus: PdfConversionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TalentDocumentRow {
  id: string;
  workspace_id: string;
  talent_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  uploaded_at: string;
  doc_kind: string;
  parsed_text: string | null;
  parse_status: string;
  text_hash: string | null;
  pdf_storage_path: string | null;
  pdf_conversion_status: string | null;
  created_at: string;
  updated_at: string;
}

export const docKindConfig: Record<DocKind, { label: string; color: string }> = {
  cv: { label: 'CV / Resume', color: 'text-blue-500' },
  cover_letter: { label: 'Cover Letter', color: 'text-indigo-500' },
  certification: { label: 'Certification', color: 'text-amber-500' },
  other: { label: 'Other', color: 'text-muted-foreground' },
};

export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ACCEPTED_FILE_EXTENSIONS = ['.pdf', '.doc', '.docx'];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function mapTalentDocumentRow(row: TalentDocumentRow): TalentDocument {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    talentId: row.talent_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    docKind: row.doc_kind as DocKind,
    parsedText: row.parsed_text,
    parseStatus: row.parse_status as ParseStatus,
    textHash: row.text_hash,
    pdfStoragePath: row.pdf_storage_path,
    pdfConversionStatus: (row.pdf_conversion_status || 'pending') as PdfConversionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
