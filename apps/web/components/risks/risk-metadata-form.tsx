import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormSelectField,
  FormTextAreaField,
  FormTextField,
} from "@/components/ui/form-fields";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
  riskTiers,
} from "@/lib/risks/types";
import type { RiskMetadataDraft } from "@/lib/risks/detail-draft";
import { formatRiskLabel } from "./risk-detail-format";

const evidenceStrengths = ["weak", "moderate", "strong"] as const;

export function RiskMetadataForm({
  draft,
  saving,
  showComplianceCopy,
  onChange,
  onSave,
  onCopyCompliance,
}: {
  draft: RiskMetadataDraft;
  saving: boolean;
  showComplianceCopy: boolean;
  onChange: (patch: Partial<RiskMetadataDraft>) => void;
  onSave: () => void;
  onCopyCompliance: () => void;
}) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Risk and compliance metadata
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <FormSelectField
          label="Risk category"
          value={draft.risk_category}
          options={riskCategories}
          formatOption={formatRiskLabel}
          onChange={(risk_category) => onChange({ risk_category })}
        />
        <FormTextField
          label="Risk score"
          type="number"
          value={draft.risk_score}
          onChange={(risk_score) => onChange({ risk_score })}
        />
        <FormSelectField
          label="Risk tier"
          value={draft.risk_tier}
          options={riskTiers}
          formatOption={formatRiskLabel}
          onChange={(risk_tier) => onChange({ risk_tier })}
        />
        <FormSelectField
          label="Cost impact"
          value={draft.cost_impact}
          options={impactLevels}
          formatOption={formatRiskLabel}
          onChange={(cost_impact) => onChange({ cost_impact })}
        />
        <FormSelectField
          label="Schedule impact"
          value={draft.schedule_impact}
          options={impactLevels}
          formatOption={formatRiskLabel}
          onChange={(schedule_impact) => onChange({ schedule_impact })}
        />
        <FormSelectField
          label="Compliance impact"
          value={draft.compliance_impact}
          options={complianceImpacts}
          formatOption={formatRiskLabel}
          onChange={(compliance_impact) => onChange({ compliance_impact })}
        />
        <FormSelectField
          label="Required artifact"
          value={draft.required_artifact}
          options={requiredArtifacts}
          formatOption={formatRiskLabel}
          onChange={(required_artifact) => onChange({ required_artifact })}
        />
        <FormTextField
          label="Spec section"
          value={draft.spec_section}
          onChange={(spec_section) => onChange({ spec_section })}
        />
        <FormTextField
          label="Drawing sheet"
          value={draft.drawing_sheet}
          onChange={(drawing_sheet) => onChange({ drawing_sheet })}
        />
        <FormTextField
          label="Responsible party"
          value={draft.responsible_party}
          onChange={(responsible_party) => onChange({ responsible_party })}
        />
        <FormTextField
          label="Responsible trade"
          value={draft.responsible_trade}
          onChange={(responsible_trade) => onChange({ responsible_trade })}
        />
        <FormSelectField
          label="Evidence strength"
          value={draft.evidence_strength}
          options={evidenceStrengths}
          formatOption={formatRiskLabel}
          onChange={(evidence_strength) => onChange({ evidence_strength })}
        />
        <div className="md:col-span-2 lg:col-span-3">
          <FormTextAreaField
            label="Blocked activity"
            value={draft.blocked_activity}
            onChange={(blocked_activity) => onChange({ blocked_activity })}
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <FormTextAreaField
            label="Risk reasoning"
            value={draft.risk_reasoning}
            onChange={(risk_reasoning) => onChange({ risk_reasoning })}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save metadata"}
        </Button>
        {showComplianceCopy && (
          <Button type="button" variant="secondary" onClick={onCopyCompliance}>
            Copy compliance packet
          </Button>
        )}
      </div>
    </Card>
  );
}
