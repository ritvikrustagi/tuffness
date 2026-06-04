import type { RiskFinding } from "@/lib/agents/risk/schema";
import { isComplianceRisk } from "@/lib/risks/compliance";

export type RiskScanMode = "risk_register_scan" | "compliance_register_scan";

export interface RiskScanProfile {
  title: string;
  focus: string;
  acceptsRisk: (risk: RiskFinding) => boolean;
  rejectionMessage: string;
}

export const riskScanProfiles: Record<RiskScanMode, RiskScanProfile> = {
  risk_register_scan: {
    title: "AI risk register scan",
    focus: `Look ONLY for evidence-backed construction risks that could affect:
- cost exposure
- schedule or blocked work
- coordination
- submittal or owner approval requirements
- possible specification deviation
- possible code, inspection, testing, or life-safety review needs`,
    acceptsRisk: () => true,
    rejectionMessage: "finding blocked by risk scan policy",
  },
  compliance_register_scan: {
    title: "AI compliance register scan",
    focus: `Look ONLY for evidence-backed compliance worklist items that could affect:
- submittal requirements
- inspection, testing, report, certificate, commissioning, or verification requirements
- owner, architect, engineer, AHJ, or design-team approval
- possible specification deviation
- closeout or turnover requirements
- RFI clarification needed to satisfy a project requirement`,
    acceptsRisk: isComplianceRisk,
    rejectionMessage: "non-compliance finding skipped",
  },
};

export function getRiskScanProfile(mode: RiskScanMode) {
  return riskScanProfiles[mode];
}
