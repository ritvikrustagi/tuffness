"use client";

import { Clipboard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SourceViewer } from "@/components/documents/source-viewer";
import { evidenceText, formatStatus, getRfi } from "@/components/issues/issue-display";
import { IssueWorkflowForm } from "@/components/issues/issue-workflow-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildDraftRfiExportText,
  buildIssueWorkflowPatch,
  getInitialIssueWorkflowDraft,
  type IssueWorkflowDraft,
} from "@/lib/issues/workflow";
import { buildComplianceItemText, isComplianceRisk } from "@/lib/risks/compliance";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
  riskTiers,
} from "@/lib/risks/types";
import type {
  ComplianceImpact,
  EvidenceStrength,
  ImpactLevel,
  Issue,
  RequiredArtifact,
  RiskCategory,
  RiskTier,
} from "@/lib/types/database";

type RiskMetadataDraft = {
  risk_category: RiskCategory | "";
  risk_score: string;
  risk_tier: RiskTier | "";
  cost_impact: ImpactLevel | "";
  schedule_impact: ImpactLevel | "";
  compliance_impact: ComplianceImpact | "";
  responsible_party: string;
  responsible_trade: string;
  spec_section: string;
  drawing_sheet: string;
  required_artifact: RequiredArtifact | "";
  blocked_activity: string;
  risk_reasoning: string;
  evidence_strength: EvidenceStrength | "";
};

const evidenceStrengths = ["weak", "moderate", "strong"] as const;

function formatLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not specified";
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : value.toFixed(0);
}

function formatConfidence(value: number | null | undefined) {
  return value === null || value === undefined ? "Not set" : `${(value * 100).toFixed(0)}%`;
}

function riskOwner(issue: Issue) {
  return issue.responsible_party ?? issue.responsible_trade ?? issue.trade ?? "Not assigned";
}

function buildRiskDraft(issue: Issue): RiskMetadataDraft {
  return {
    risk_category: issue.risk_category ?? "",
    risk_score: issue.risk_score === null ? "" : String(issue.risk_score),
    risk_tier: issue.risk_tier ?? "",
    cost_impact: issue.cost_impact ?? "",
    schedule_impact: issue.schedule_impact ?? "",
    compliance_impact: issue.compliance_impact ?? "",
    responsible_party: issue.responsible_party ?? "",
    responsible_trade: issue.responsible_trade ?? "",
    spec_section: issue.spec_section ?? "",
    drawing_sheet: issue.drawing_sheet ?? "",
    required_artifact: issue.required_artifact ?? "",
    blocked_activity: issue.blocked_activity ?? "",
    risk_reasoning: issue.risk_reasoning ?? "",
    evidence_strength: issue.evidence_strength ?? "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildRiskMetadataPayload(draft: RiskMetadataDraft) {
  return {
    risk_category: draft.risk_category || null,
    risk_score: draft.risk_score.trim() === "" ? null : Number(draft.risk_score),
    risk_tier: draft.risk_tier || null,
    cost_impact: draft.cost_impact || null,
    schedule_impact: draft.schedule_impact || null,
    compliance_impact: draft.compliance_impact || null,
    responsible_party: emptyToNull(draft.responsible_party),
    responsible_trade: emptyToNull(draft.responsible_trade),
    spec_section: emptyToNull(draft.spec_section),
    drawing_sheet: emptyToNull(draft.drawing_sheet),
    required_artifact: draft.required_artifact || null,
    blocked_activity: emptyToNull(draft.blocked_activity),
    risk_reasoning: emptyToNull(draft.risk_reasoning),
    evidence_strength: draft.evidence_strength || null,
  };
}

function updateIssueFromResponse(data: unknown): Issue | null {
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

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (value: T | "") => void;
}) {
  return (
    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        value={value}
        onChange={(event) => onChange(event.target.value as T | "")}
      >
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <textarea
        className="mt-1 min-h-24 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function RiskDetailWorkspace({
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
  const [riskDraft, setRiskDraft] = useState(() => buildRiskDraft(issue));
  const [saving, setSaving] = useState<"workflow" | "metadata" | "reviewed" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const evidence = issue.evidence ?? [];
  const complianceRisk = isComplianceRisk(issue);

  async function patchIssue(payload: Record<string, unknown>, successMessage: string) {
    setSaving(payload.reviewed ? "reviewed" : payload.workflow_state ? "workflow" : "metadata");
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
      const updatedIssue = updateIssueFromResponse(data);
      if (updatedIssue) {
        setIssue(updatedIssue);
        setRiskDraft(buildRiskDraft(updatedIssue));
        setWorkflowDraft(getInitialIssueWorkflowDraft({ issue: updatedIssue, rfi: getRfi(updatedIssue) }));
      }
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save risk");
    } finally {
      setSaving(null);
    }
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
    const safeSubject = issue.summary.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${safeSubject || "draft-rfi"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Draft RFI exported.");
    setError(null);
  }

  function updateRiskDraft(patch: Partial<RiskMetadataDraft>) {
    setRiskDraft((current) => ({ ...current, ...patch }));
  }

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
          <Button type="button" variant="secondary" onClick={copyCompliancePacket} className="gap-2">
            <Clipboard className="h-4 w-4" />
            Copy compliance packet
          </Button>
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

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {issue.summary || "Untitled risk"}
            </h2>
            <p className="mt-1 text-sm capitalize text-zinc-500">
              {formatLabel(issue.risk_category)} · Score {formatScore(issue.risk_score)} ·{" "}
              Confidence {formatConfidence(issue.confidence)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {issue.risk_tier && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium capitalize text-orange-800">
                {issue.risk_tier}
              </span>
            )}
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
              {formatStatus(issue.status)}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
              {issue.human_reviewed_at ? "Reviewed" : "Needs review"}
            </span>
          </div>
        </div>

        {issue.description && (
          <p className="mt-4 break-words text-sm text-zinc-700 dark:text-zinc-300">
            {issue.description}
          </p>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Compliance", formatLabel(issue.compliance_impact)],
            ["Artifact", formatLabel(issue.required_artifact)],
            ["Spec section", issue.spec_section ?? "Not specified"],
            ["Responsible", riskOwner(issue)],
            ["Drawing sheet", issue.drawing_sheet ?? "Not specified"],
            ["Cost", formatLabel(issue.cost_impact)],
            ["Schedule", formatLabel(issue.schedule_impact)],
            ["Evidence", formatLabel(issue.evidence_strength)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
              <dd className="mt-1 break-words text-sm capitalize text-zinc-800 dark:text-zinc-200">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {issue.recommended_action && (
          <p className="mt-4 break-words text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Recommended action: {issue.recommended_action}
          </p>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Review status
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {issue.human_reviewed_at
                ? `Reviewed ${new Date(issue.human_reviewed_at).toLocaleString()}`
                : "Awaiting human review"}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => patchIssue({ reviewed: true }, "Risk marked reviewed.")}
            disabled={saving !== null}
          >
            {saving === "reviewed" ? "Saving..." : "Mark reviewed"}
          </Button>
        </div>
      </Card>

      {evidence.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Evidence</h3>
          <div className="mt-3 space-y-3">
            {evidence.map((item, index) => (
              <div
                key={`${issue.id}-evidence-${index}`}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="break-words text-xs font-medium text-orange-700 dark:text-orange-400">
                  {item.document_name ?? "Document"}
                  {item.page_number ? ` · Page ${item.page_number}` : ""}
                </p>
                <p className="mt-1 break-words text-sm text-zinc-700 dark:text-zinc-300">
                  {evidenceText(item) || "Evidence excerpt unavailable."}
                </p>
                <SourceViewer projectId={projectId} evidence={item} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Risk and compliance metadata
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Risk category"
            value={riskDraft.risk_category}
            options={riskCategories}
            onChange={(risk_category) => updateRiskDraft({ risk_category })}
          />
          <TextField
            label="Risk score"
            type="number"
            value={riskDraft.risk_score}
            onChange={(risk_score) => updateRiskDraft({ risk_score })}
          />
          <SelectField
            label="Risk tier"
            value={riskDraft.risk_tier}
            options={riskTiers}
            onChange={(risk_tier) => updateRiskDraft({ risk_tier })}
          />
          <SelectField
            label="Cost impact"
            value={riskDraft.cost_impact}
            options={impactLevels}
            onChange={(cost_impact) => updateRiskDraft({ cost_impact })}
          />
          <SelectField
            label="Schedule impact"
            value={riskDraft.schedule_impact}
            options={impactLevels}
            onChange={(schedule_impact) => updateRiskDraft({ schedule_impact })}
          />
          <SelectField
            label="Compliance impact"
            value={riskDraft.compliance_impact}
            options={complianceImpacts}
            onChange={(compliance_impact) => updateRiskDraft({ compliance_impact })}
          />
          <SelectField
            label="Required artifact"
            value={riskDraft.required_artifact}
            options={requiredArtifacts}
            onChange={(required_artifact) => updateRiskDraft({ required_artifact })}
          />
          <TextField
            label="Spec section"
            value={riskDraft.spec_section}
            onChange={(spec_section) => updateRiskDraft({ spec_section })}
          />
          <TextField
            label="Drawing sheet"
            value={riskDraft.drawing_sheet}
            onChange={(drawing_sheet) => updateRiskDraft({ drawing_sheet })}
          />
          <TextField
            label="Responsible party"
            value={riskDraft.responsible_party}
            onChange={(responsible_party) => updateRiskDraft({ responsible_party })}
          />
          <TextField
            label="Responsible trade"
            value={riskDraft.responsible_trade}
            onChange={(responsible_trade) => updateRiskDraft({ responsible_trade })}
          />
          <SelectField
            label="Evidence strength"
            value={riskDraft.evidence_strength}
            options={evidenceStrengths}
            onChange={(evidence_strength) => updateRiskDraft({ evidence_strength })}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <TextAreaField
              label="Blocked activity"
              value={riskDraft.blocked_activity}
              onChange={(blocked_activity) => updateRiskDraft({ blocked_activity })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <TextAreaField
              label="Risk reasoning"
              value={riskDraft.risk_reasoning}
              onChange={(risk_reasoning) => updateRiskDraft({ risk_reasoning })}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              patchIssue(buildRiskMetadataPayload(riskDraft), "Risk metadata saved and reviewed.")
            }
            disabled={saving !== null}
          >
            {saving === "metadata" ? "Saving..." : "Save metadata"}
          </Button>
          {complianceRisk && (
            <Button type="button" variant="secondary" onClick={copyCompliancePacket}>
              Copy compliance packet
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Workflow and RFI
        </h3>
        <IssueWorkflowForm
          draft={workflowDraft}
          saving={saving === "workflow"}
          onChange={(patch) => setWorkflowDraft((current) => ({ ...current, ...patch }))}
          onSave={() =>
            patchIssue(buildIssueWorkflowPatch(workflowDraft), "Issue workflow saved.")
          }
          onCopy={copyDraftRfi}
          onExport={exportDraftRfi}
        />
      </Card>
    </div>
  );
}
