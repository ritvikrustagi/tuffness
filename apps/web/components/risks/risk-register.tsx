"use client";

import { useMemo, useState } from "react";
import type { Issue } from "@/lib/types/database";
import {
  complianceGroups,
  summarizeComplianceRisks,
} from "@/lib/risks/compliance";
import { buildComplianceCsv, buildRiskCsv } from "@/lib/risks/export";
import { complianceImpacts, requiredArtifacts, riskTiers } from "@/lib/risks/types";
import {
  filterRiskRegisterRisks,
  type RiskRegisterArtifactFilter,
  type RiskRegisterComplianceFilter,
  type RiskRegisterGroupFilter,
  type RiskRegisterTierFilter,
  type RiskRegisterView,
} from "@/lib/risks/register";
import { summarizeRisks } from "@/lib/risks/summary";
import { RiskCard } from "@/components/risks/risk-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function RiskRegister({ projectId, risks }: { projectId: string; risks: Issue[] }) {
  const [view, setView] = useState<RiskRegisterView>("all");
  const [tierFilter, setTierFilter] = useState<RiskRegisterTierFilter>("all");
  const [complianceFilter, setComplianceFilter] = useState<RiskRegisterComplianceFilter>("all");
  const [artifactFilter, setArtifactFilter] = useState<RiskRegisterArtifactFilter>("all");
  const [groupFilter, setGroupFilter] = useState<RiskRegisterGroupFilter>("all");

  const filteredRisks = useMemo(
    () =>
      filterRiskRegisterRisks(risks, {
        view,
        tierFilter,
        complianceFilter,
        artifactFilter,
        groupFilter,
      }),
    [artifactFilter, complianceFilter, groupFilter, risks, tierFilter, view]
  );

  const summary = useMemo(() => summarizeRisks(filteredRisks), [filteredRisks]);
  const complianceSummary = useMemo(
    () => summarizeComplianceRisks(filteredRisks),
    [filteredRisks]
  );
  const summaryCards = [
    ...(view === "compliance"
      ? [
          { label: "Open compliance", value: complianceSummary.open },
          { label: "High impact", value: complianceSummary.high_impact },
          { label: "Submittals", value: complianceSummary.submittals_required },
          {
            label: "Inspections/testing",
            value: complianceSummary.inspection_or_testing_required,
          },
          { label: "Owner approvals", value: complianceSummary.owner_approvals_required },
          { label: "Awaiting review", value: complianceSummary.awaiting_review },
        ]
      : [
          { label: "Open risks", value: summary.open },
          { label: "Critical/high", value: summary.critical_or_high },
          { label: "Compliance exposure", value: summary.compliance_exposure },
          { label: "Draft RFIs needed", value: summary.draft_rfis_needed },
          { label: "Awaiting review", value: summary.awaiting_review },
        ]),
  ];

  function exportCsv() {
    if (filteredRisks.length === 0) return;

    const csv = view === "compliance" ? buildComplianceCsv(filteredRisks) : buildRiskCsv(filteredRisks);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = view === "compliance" ? "compliance-register.csv" : "risk-register.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All Risks"],
          ["compliance", "Compliance"],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={view === value ? "primary" : "secondary"}
            onClick={() => setView(value as RiskRegisterView)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {summaryCards.map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="mb-1 block">Tier</span>
            <select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value as RiskRegisterTierFilter)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="all">All tiers</option>
              {riskTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>

          {view === "compliance" && (
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="mb-1 block">Group</span>
              <select
                value={groupFilter}
                onChange={(event) =>
                  setGroupFilter(event.target.value as RiskRegisterGroupFilter)
                }
                className="h-10 max-w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="all">All groups</option>
                {complianceGroups.map((group) => (
                  <option key={group} value={group}>
                    {formatLabel(group)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="mb-1 block">Compliance</span>
            <select
              value={complianceFilter}
              onChange={(event) =>
                setComplianceFilter(event.target.value as RiskRegisterComplianceFilter)
              }
              className="h-10 max-w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="all">All compliance</option>
              {complianceImpacts.map((impact) => (
                <option key={impact} value={impact}>
                  {formatLabel(impact)}
                </option>
              ))}
            </select>
          </label>

          {view === "compliance" && (
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="mb-1 block">Required artifact</span>
              <select
                value={artifactFilter}
                onChange={(event) =>
                  setArtifactFilter(event.target.value as RiskRegisterArtifactFilter)
                }
                className="h-10 max-w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="all">All artifacts</option>
                {requiredArtifacts.map((artifact) => (
                  <option key={artifact} value={artifact}>
                    {formatLabel(artifact)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={exportCsv}
          disabled={filteredRisks.length === 0}
        >
          {view === "compliance" ? "Export Compliance CSV" : "Export CSV"}
        </Button>
      </div>

      {filteredRisks.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {view === "compliance"
              ? "No compliance items match the current filters."
              : "No risks match the current filters."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRisks.map((risk) => (
            <RiskCard key={risk.id} projectId={projectId} risk={risk} />
          ))}
        </div>
      )}
    </div>
  );
}
