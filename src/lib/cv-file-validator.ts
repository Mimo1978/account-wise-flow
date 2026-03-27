export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function validateCVFile(
  file: File
): Promise<ValidationResult> {
  // 1. Extension check
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported format. Use PDF, DOC or DOCX.`,
    };
  }

  // 2. Size check
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" is ${mb}MB. Maximum is 10MB.`,
    };
  }

  // 3. File header check (magic bytes)
  const header = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(header);

  const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50
    && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const isDOCX = bytes[0] === 0x50 && bytes[1] === 0x4B; // PK (zip)
  const isLegacyDOC = bytes[0] === 0xD0 && bytes[1] === 0xCF; // D0CF

  if (!isPDF && !isDOCX && !isLegacyDOC) {
    return {
      valid: false,
      error: `"${file.name}" doesn't appear to be a valid PDF or Word document.`,
    };
  }

  return { valid: true };
}

export async function validateBatch(
  files: File[]
): Promise<{ valid: File[]; rejected: Array<{ file: File; error: string }> }> {
  const valid: File[] = [];
  const rejected: Array<{ file: File; error: string }> = [];

  for (const file of files) {
    const result = await validateCVFile(file);
    if (result.valid) {
      valid.push(file);
    } else {
      rejected.push({ file, error: result.error! });
    }
  }

  return { valid, rejected };
}
