"use client";

import { Clipboard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { IssueWorkflowForm } from "@/components/issues/issue-workflow-form";
import { Card } from "@/components/ui/card";
import { isComplianceRisk } from "@/lib/risks/compliance";
import type { Issue } from "@/lib/types/database";
import { RiskEvidencePanel } from "./risk-evidence-panel";
import { RiskMetadataForm } from "./risk-metadata-form";
import { RiskReviewPanel } from "./risk-review-panel";
import { RiskSummaryPanel } from "./risk-summary-panel";
import { useRiskDetailActions } from "./use-risk-detail-actions";

export function RiskDetailWorkspace({
  projectId,
  initialIssue,
}: {
  projectId: string;
  initialIssue: Issue;
}) {
  const {
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
    saveMetadata,
    saveWorkflow,
    markReviewed,
  } = useRiskDetailActions({ projectId, initialIssue });
  const complianceRisk = isComplianceRisk(issue);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}/risks`}
          className="text-sm font-medium text-orange-700 hover:text-orange-800 dark:text-orange-400"
        >
          Back to risk register
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyCompliancePacket}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Clipboard className="h-4 w-4" />
            Copy compliance packet
          </button>
          {issue.external_system_url && (
            <a
              href={issue.external_system_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ExternalLink className="h-4 w-4" />
              External issue
            </a>
          )}
        </div>
      </div>

      <RiskSummaryPanel issue={issue} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <RiskReviewPanel
        issue={issue}
        saving={saving !== null}
        onMarkReviewed={markReviewed}
      />

      <RiskEvidencePanel projectId={projectId} issue={issue} />

      <RiskMetadataForm
        draft={riskDraft}
        saving={saving === "metadata"}
        showComplianceCopy={complianceRisk}
        onChange={updateRiskDraft}
        onSave={saveMetadata}
        onCopyCompliance={copyCompliancePacket}
      />

      <Card>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Workflow and RFI
        </h3>
        <IssueWorkflowForm
          draft={workflowDraft}
          saving={saving === "workflow"}
          onChange={(patch) => setWorkflowDraft((current) => ({ ...current, ...patch }))}
          onSave={saveWorkflow}
          onCopy={copyDraftRfi}
          onExport={exportDraftRfi}
        />
      </Card>
    </div>
  );
}
