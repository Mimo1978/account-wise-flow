export interface FailedImportItemLike {
  id: string;
  file_name: string;
  error_message: string | null;
}

export interface FailedImportInsight {
  fingerprint: string;
  category: string;
  title: string;
  detail: string;
  nextAction: string;
  severity: "high" | "medium" | "low";
}

export interface FailedImportSummaryGroup extends FailedImportInsight {
  count: number;
}

const ISSUE_RULES: Array<{
  test: (message: string) => boolean;
  insight: FailedImportInsight;
}> = [
  {
    test: (message) => message.includes("maximum call stack size exceeded"),
    insight: {
      fingerprint: "pdf-memory-overflow",
      category: "Renderer limit",
      title: "Large document hit the old PDF conversion limit",
      detail: "This file failed while being converted in memory, which usually affects larger or image-heavy CVs.",
      nextAction: "Reprocess this file in a fresh retry batch using the newer safer pipeline.",
      severity: "high",
    },
  },
  {
    test: (message) => message.includes("failed to download file"),
    insight: {
      fingerprint: "storage-download-error",
      category: "Storage access",
      title: "The stored file could not be read",
      detail: "The processor could not fetch the uploaded CV from storage when the batch reached this item.",
      nextAction: "Retry this file. If it fails again, re-upload the original file to refresh the stored copy.",
      severity: "high",
    },
  },
  {
    test: (message) => message.includes("text extraction failed"),
    insight: {
      fingerprint: "text-extraction-error",
      category: "Text extraction",
      title: "The CV content could not be extracted cleanly",
      detail: "The document format, embedded fonts, or scan quality prevented reliable text extraction.",
      nextAction: "Retry first. If it still fails, use a cleaner PDF or DOCX export of the same CV.",
      severity: "medium",
    },
  },
  {
    test: (message) => message.includes("ai parsing failed") || message.includes("ai service"),
    insight: {
      fingerprint: "ai-processing-error",
      category: "AI parsing",
      title: "The CV was read but structured parsing failed",
      detail: "The parsing step could not convert the extracted content into a clean candidate record.",
      nextAction: "Retry in a new batch. If the issue repeats, review the original file formatting.",
      severity: "medium",
    },
  },
  {
    test: (message) => message.includes("failed to mark item as parsed") || message.includes("metadata enrichment failed"),
    insight: {
      fingerprint: "metadata-write-error",
      category: "Record update",
      title: "The file processed but metadata could not be fully saved",
      detail: "Candidate creation or item metadata persistence did not finish cleanly.",
      nextAction: "Retry the file so the pipeline can rebuild the candidate metadata from scratch.",
      severity: "medium",
    },
  },
];

const fallbackInsight: FailedImportInsight = {
  fingerprint: "generic-processing-error",
  category: "Processing issue",
  title: "This CV stopped during processing",
  detail: "The importer hit an unexpected error for this document.",
  nextAction: "Retry this file in a fresh batch and review the message if it fails again.",
  severity: "low",
};

export function classifyImportError(errorMessage: string | null | undefined): FailedImportInsight {
  const message = (errorMessage || "").trim().toLowerCase();

  if (!message) {
    return {
      ...fallbackInsight,
      title: "This CV stopped without a detailed error message",
      detail: "The importer did not receive a full failure reason for this item.",
    };
  }

  const rule = ISSUE_RULES.find((candidate) => candidate.test(message));
  return rule ? rule.insight : fallbackInsight;
}

export function buildFailedImportSummary(items: FailedImportItemLike[]): FailedImportSummaryGroup[] {
  const grouped = new Map<string, FailedImportSummaryGroup>();

  for (const item of items) {
    const insight = classifyImportError(item.error_message);
    const existing = grouped.get(insight.fingerprint);

    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(insight.fingerprint, {
      ...insight,
      count: 1,
    });
  }

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count);
}