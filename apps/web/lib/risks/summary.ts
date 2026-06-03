import type { RiskLike } from "./types";

export type RiskSummary = {
  total: number;
  open: number;
  critical_or_high: number;
  compliance_exposure: number;
  draft_rfis_needed: number;
  awaiting_review: number;
  closed: number;
};

function isClosedRisk(risk: RiskLike) {
  return risk.status === "resolved" || risk.status === "dismissed";
}

export function summarizeRisks(risks: RiskLike[]): RiskSummary {
  return risks.reduce<RiskSummary>(
    (summary, risk) => {
      const closed = isClosedRisk(risk);

      summary.total += 1;

      if (closed) {
        summary.closed += 1;
        return summary;
      }

      summary.open += 1;
      summary.awaiting_review += 1;

      if (risk.tier === "critical" || risk.tier === "high") {
        summary.critical_or_high += 1;
      }

      if (risk.compliance_impact && risk.compliance_impact !== "none") {
        summary.compliance_exposure += 1;
      }

      if (risk.required_artifact === "rfi") {
        summary.draft_rfis_needed += 1;
      }

      return summary;
    },
    {
      total: 0,
      open: 0,
      critical_or_high: 0,
      compliance_exposure: 0,
      draft_rfis_needed: 0,
      awaiting_review: 0,
      closed: 0,
    }
  );
}
