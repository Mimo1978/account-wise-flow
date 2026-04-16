import { supabase } from "@/integrations/supabase/client";
import type { TalentDocument } from "@/lib/talent-document-types";

export const CV_STORAGE_BUCKETS = ["candidate_cvs", "cv-uploads", "talent-documents"] as const;

export type CVStorageBucket = (typeof CV_STORAGE_BUCKETS)[number];

export type CVFileKind = "pdf" | "docx" | "doc" | "unknown";

export function resolveStorageBuckets(filePath?: string | null): readonly CVStorageBucket[] {
  if (!filePath) return CV_STORAGE_BUCKETS;

  const normalized = filePath.toLowerCase();
  if (normalized.startsWith("cv-uploads/")) return ["cv-uploads", "candidate_cvs", "talent-documents"];
  if (normalized.startsWith("candidate_cvs/")) return ["candidate_cvs", "cv-uploads", "talent-documents"];
  if (normalized.startsWith("talent-documents/")) return ["talent-documents", "cv-uploads", "candidate_cvs"];

  return CV_STORAGE_BUCKETS;
}

export function normalizeStoragePath(filePath?: string | null): string | null {
  if (!filePath) return null;

  return filePath
    .replace(/^candidate_cvs\//i, "")
    .replace(/^cv-uploads\//i, "")
    .replace(/^talent-documents\//i, "");
}

export function getDocumentExtension(fileNameOrPath?: string | null): string {
  if (!fileNameOrPath) return "";
  const source = fileNameOrPath.toLowerCase().split("?")[0].split("#")[0];
  const lastDot = source.lastIndexOf(".");
  return lastDot >= 0 ? source.slice(lastDot + 1) : "";
}

export function getDocumentKind(document: Pick<TalentDocument, "fileName" | "fileType" | "filePath" | "pdfStoragePath">): CVFileKind {
  const extension = getDocumentExtension(document.fileName || document.filePath || document.pdfStoragePath);
  const normalizedType = document.fileType?.toLowerCase() || "";

  if (extension === "pdf" || normalizedType.includes("pdf")) return "pdf";
  if (extension === "docx" || normalizedType.includes("docx")) return "docx";
  if (extension === "doc" || normalizedType === "doc") return "doc";

  return "unknown";
}

export async function downloadStoredFile(filePath?: string | null): Promise<{ blob: Blob; bucket: CVStorageBucket; normalizedPath: string } | null> {
  const normalizedPath = normalizeStoragePath(filePath);
  if (!normalizedPath) return null;

  for (const bucket of resolveStorageBuckets(filePath)) {
    const result = await supabase.storage.from(bucket).download(normalizedPath);
    if (!result.error && result.data) {
      return { blob: result.data, bucket, normalizedPath };
    }
  }

  return null;
}

export async function createSignedDocumentUrl(filePath?: string | null, expiresIn = 3600): Promise<string | null> {
  const normalizedPath = normalizeStoragePath(filePath);
  if (!normalizedPath) return null;

  for (const bucket of resolveStorageBuckets(filePath)) {
    const result = await supabase.storage.from(bucket).createSignedUrl(normalizedPath, expiresIn);
    if (!result.error && result.data?.signedUrl) {
      return result.data.signedUrl;
    }
  }

  return null;
}