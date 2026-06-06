"use client";

import { useMemo, useState } from "react";
import { getRfi } from "@/components/issues/issue-display";
import {
  buildDraftRfiDownloadName,
  buildDraftRfiExportText,
  buildIssueWorkflowPatch,
  getInitialIssueWorkflowDraft,
  type IssueWorkflowDraft,
} from "@/lib/issues/workflow";
import { buildComplianceItemText } from "@/lib/risks/compliance";
import {
  buildRiskMetadataDraft,
  buildRiskMetadataPayload,
  type RiskMetadataDraft,
} from "@/lib/risks/detail-draft";
import type { Issue } from "@/lib/types/database";

export type RiskDetailSaveKind = "workflow" | "metadata" | "reviewed";

function issueFromResponse(data: unknown): Issue | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "issue" in data &&
    typeof (data as { issue: unknown }).issue === "object"
  ) {
    return (data as { issue: Issue }).issue;
  }

  return null;
}

export function useRiskDetailActions({
  projectId,
  initialIssue,
}: {
  projectId: string;
  initialIssue: Issue;
}) {
  const [issue, setIssue] = useState(initialIssue);
  const initialWorkflowDraft = useMemo(
    () => getInitialIssueWorkflowDraft({ issue, rfi: getRfi(issue) }),
    [issue]
  );
  const [workflowDraft, setWorkflowDraft] =
    useState<IssueWorkflowDraft>(initialWorkflowDraft);
  const [riskDraft, setRiskDraft] = useState(() => buildRiskMetadataDraft(issue));
  const [saving, setSaving] = useState<RiskDetailSaveKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetDrafts(updatedIssue: Issue) {
    setIssue(updatedIssue);
    setRiskDraft(buildRiskMetadataDraft(updatedIssue));
    setWorkflowDraft(getInitialIssueWorkflowDraft({ issue: updatedIssue, rfi: getRfi(updatedIssue) }));
  }

  async function patchIssue(
    kind: RiskDetailSaveKind,
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    setSaving(kind);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save risk");

      const updatedIssue = issueFromResponse(data);
      if (updatedIssue) resetDrafts(updatedIssue);
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save risk");
    } finally {
      setSaving(null);
    }
  }

  function updateRiskDraft(patch: Partial<RiskMetadataDraft>) {
    setRiskDraft((current) => ({ ...current, ...patch }));
  }

  async function copyCompliancePacket() {
    await navigator.clipboard.writeText(buildComplianceItemText(issue));
    setMessage("Compliance packet copied.");
    setError(null);
  }

  async function copyDraftRfi() {
    if (!workflowDraft.draft_rfi) return;
    await navigator.clipboard.writeText(buildDraftRfiExportText({ issue, draft: workflowDraft }));
    setMessage("Draft RFI copied with evidence.");
    setError(null);
  }

  function exportDraftRfi() {
    if (!workflowDraft.draft_rfi) return;

    const blob = new Blob([buildDraftRfiExportText({ issue, draft: workflowDraft })], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildDraftRfiDownloadName(issue.summary);
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Draft RFI exported.");
    setError(null);
  }

  return {
    issue,
    workflowDraft,
    riskDraft,
    saving,
    message,
    error,
    setWorkflowDraft,
    updateRiskDraft,
    copyCompliancePacket,
    copyDraftRfi,
    exportDraftRfi,
    saveMetadata: () =>
      patchIssue("metadata", buildRiskMetadataPayload(riskDraft), "Risk metadata saved and reviewed."),
    saveWorkflow: () =>
      patchIssue("workflow", buildIssueWorkflowPatch(workflowDraft), "Issue workflow saved."),
    markReviewed: () =>
      patchIssue("reviewed", { mark_reviewed: true }, "Risk marked reviewed."),
  };
}
