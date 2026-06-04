"use client";

import { useMemo, useState } from "react";
import type { Issue } from "@/lib/types/database";
import { buildRiskCsv } from "@/lib/risks/export";
import { complianceImpacts, riskTiers } from "@/lib/risks/types";
import { summarizeRisks } from "@/lib/risks/summary";
import { RiskCard } from "@/components/risks/risk-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TierFilter = "all" | NonNullable<Issue["risk_tier"]>;
type ComplianceFilter = "all" | NonNullable<Issue["compliance_impact"]>;

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function RiskRegister({ projectId, risks }: { projectId: string; risks: Issue[] }) {
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("all");

  const filteredRisks = useMemo(
    () =>
      risks.filter((risk) => {
        const matchesTier = tierFilter === "all" || risk.risk_tier === tierFilter;
        const matchesCompliance =
          complianceFilter === "all" || risk.compliance_impact === complianceFilter;

        return matchesTier && matchesCompliance;
      }),
    [complianceFilter, risks, tierFilter]
  );

  const summary = useMemo(() => summarizeRisks(filteredRisks), [filteredRisks]);
  const summaryCards = [
    { label: "Open risks", value: summary.open },
    { label: "Critical/high", value: summary.critical_or_high },
    { label: "Compliance exposure", value: summary.compliance_exposure },
    { label: "Draft RFIs needed", value: summary.draft_rfis_needed },
    { label: "Awaiting review", value: summary.awaiting_review },
  ];

  function exportCsv() {
    if (filteredRisks.length === 0) return;

    const blob = new Blob([buildRiskCsv(filteredRisks)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "risk-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              onChange={(event) => setTierFilter(event.target.value as TierFilter)}
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

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="mb-1 block">Compliance</span>
            <select
              value={complianceFilter}
              onChange={(event) => setComplianceFilter(event.target.value as ComplianceFilter)}
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
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={exportCsv}
          disabled={filteredRisks.length === 0}
        >
          Export CSV
        </Button>
      </div>

      {filteredRisks.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No risks match the current filters.
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
