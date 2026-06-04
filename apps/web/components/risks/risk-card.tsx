"use client";

import { Clipboard } from "lucide-react";
import { useState } from "react";
import type { Issue } from "@/lib/types/database";
import { SourceViewer } from "@/components/documents/source-viewer";
import { evidenceText, formatStatus } from "@/components/issues/issue-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildComplianceItemText, isComplianceRisk } from "@/lib/risks/compliance";

const tierColors: Record<NonNullable<Issue["risk_tier"]>, string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

function formatLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not specified";
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : value.toFixed(1);
}

function formatConfidence(value: number | null | undefined) {
  return value === null || value === undefined ? "Confidence not set" : `${(value * 100).toFixed(0)}%`;
}

function riskOwner(issue: Issue) {
  return issue.responsible_party ?? issue.responsible_trade ?? issue.trade ?? "Not assigned";
}

export function RiskCard({ projectId, risk }: { projectId: string; risk: Issue }) {
  const evidence = risk.evidence ?? [];
  const [copied, setCopied] = useState(false);
  const complianceRisk = isComplianceRisk(risk);

  async function copyCompliancePacket() {
    await navigator.clipboard.writeText(buildComplianceItemText(risk));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-zinc-900 dark:text-zinc-50">
            {risk.summary || "Untitled risk"}
          </h3>
          <p className="mt-1 text-xs capitalize text-zinc-500">
            {formatLabel(risk.risk_category)} · Score {formatScore(risk.risk_score)} ·{" "}
            {formatConfidence(risk.confidence)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {risk.risk_tier && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierColors[risk.risk_tier]}`}
            >
              {risk.risk_tier}
            </span>
          )}
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
            {formatStatus(risk.status)}
          </span>
        </div>
      </div>

      {risk.description && (
        <p className="mt-3 break-words text-sm text-zinc-700 dark:text-zinc-300">
          {risk.description}
        </p>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cost", formatLabel(risk.cost_impact)],
          ["Schedule", formatLabel(risk.schedule_impact)],
          ["Compliance", formatLabel(risk.compliance_impact)],
          ["Responsible", riskOwner(risk)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="mt-1 break-words text-sm capitalize text-zinc-800 dark:text-zinc-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {complianceRisk && (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Required artifact", formatLabel(risk.required_artifact)],
            ["Spec section", risk.spec_section ?? "Not specified"],
            ["Drawing sheet", risk.drawing_sheet ?? "Not specified"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm capitalize text-zinc-800 dark:text-zinc-200">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {risk.recommended_action && (
        <p className="mt-4 break-words text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Recommended action: {risk.recommended_action}
        </p>
      )}

      {complianceRisk && (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={copyCompliancePacket}
            className="gap-2"
          >
            <Clipboard className="h-4 w-4" />
            {copied ? "Copied" : "Copy compliance packet"}
          </Button>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Evidence</p>
          <div className="mt-2 space-y-2">
            {evidence.map((item, index) => (
              <div
                key={`${risk.id}-evidence-${index}`}
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
        </div>
      )}
    </Card>
  );
}
