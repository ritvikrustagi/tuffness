import { formatStatus } from "@/components/issues/issue-display";
import { Card } from "@/components/ui/card";
import type { Issue } from "@/lib/types/database";
import {
  formatRiskConfidence,
  formatRiskLabel,
  formatRiskScore,
  riskOwner,
} from "./risk-detail-format";

export function RiskSummaryPanel({ issue }: { issue: Issue }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {issue.summary || "Untitled risk"}
          </h2>
          <p className="mt-1 text-sm capitalize text-zinc-500">
            {formatRiskLabel(issue.risk_category)} · Score {formatRiskScore(issue.risk_score)} ·{" "}
            Confidence {formatRiskConfidence(issue.confidence)}
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
          ["Compliance", formatRiskLabel(issue.compliance_impact)],
          ["Artifact", formatRiskLabel(issue.required_artifact)],
          ["Spec section", issue.spec_section ?? "Not specified"],
          ["Responsible", riskOwner(issue)],
          ["Drawing sheet", issue.drawing_sheet ?? "Not specified"],
          ["Cost", formatRiskLabel(issue.cost_impact)],
          ["Schedule", formatRiskLabel(issue.schedule_impact)],
          ["Evidence", formatRiskLabel(issue.evidence_strength)],
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
  );
}
