import type { IssueEvidence } from "@/lib/types/database";
import { formatOptionalLine, type IssueWorkflowDraft } from "./workflow-draft";

export function buildDraftRfiExportText(input: {
  issue: {
    summary: string;
    description: string | null;
    severity: string;
    trade: string | null;
    discipline: string | null;
    due_date: string | null;
    evidence: IssueEvidence[];
  };
  draft: IssueWorkflowDraft;
}): string {
  const lines: string[] = [
    `Subject: ${input.issue.summary}`,
    "",
    "Question:",
    input.draft.draft_rfi.trim(),
  ];

  const metadata = [
    formatOptionalLine("Severity", input.issue.severity),
    formatOptionalLine("Trade", input.draft.trade || input.issue.trade),
    formatOptionalLine("Discipline", input.draft.discipline || input.issue.discipline),
    formatOptionalLine("Due Date", input.draft.due_date || input.issue.due_date),
  ].filter((line): line is string => Boolean(line));

  if (metadata.length > 0) {
    lines.push("", "Metadata:", ...metadata);
  }

  if (input.issue.description) {
    lines.push("", "Background:", input.issue.description.trim());
  }

  if (input.issue.evidence.length > 0) {
    lines.push("", "Evidence:");
    input.issue.evidence.forEach((item, index) => {
      const source = item.document_name ?? "Document";
      const page = item.page_number ? `, page ${item.page_number}` : "";
      const quote = item.quote ?? item.excerpt ?? "";
      lines.push(`${index + 1}. ${source}${page}: ${quote}`);
    });
  }

  const externalFields = [
    formatOptionalLine("External RFI Number", input.draft.external_rfi_number),
    formatOptionalLine("External RFI URL", input.draft.external_url),
    formatOptionalLine("External Issue URL", input.draft.external_system_url),
  ].filter((line): line is string => Boolean(line));

  if (externalFields.length > 0) {
    lines.push("", "External Tracking:", ...externalFields);
  }

  return lines.join("\n");
}
