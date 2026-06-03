import type { DocumentStatus, SubmittalReviewStatus } from "@/lib/types/database";

export type DocumentReadinessSummary = {
  total: number;
  ready: number;
  in_progress: number;
  failed: number;
};

export type SubmittalReviewSummary = {
  total: number;
  pending: number;
  pass: number;
  warning: number;
  fail: number;
};

export function summarizeDocuments(
  documents: Array<{ status: DocumentStatus }>
): DocumentReadinessSummary {
  return documents.reduce<DocumentReadinessSummary>(
    (summary, document) => {
      summary.total += 1;
      if (document.status === "ready") summary.ready += 1;
      if (document.status === "failed") summary.failed += 1;
      if (document.status === "pending" || document.status === "processing") {
        summary.in_progress += 1;
      }
      return summary;
    },
    { total: 0, ready: 0, in_progress: 0, failed: 0 }
  );
}

export function summarizeSubmittals(
  submittals: Array<{ review_status: SubmittalReviewStatus }>
): SubmittalReviewSummary {
  return submittals.reduce<SubmittalReviewSummary>(
    (summary, submittal) => {
      summary.total += 1;
      summary[submittal.review_status] += 1;
      return summary;
    },
    { total: 0, pending: 0, pass: 0, warning: 0, fail: 0 }
  );
}
