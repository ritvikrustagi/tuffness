import {
  riskMetadataPatchFields,
  type RiskMetadataPatch,
} from "@/lib/risks/validation";

function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRiskMetadataRpcPatch(
  input: RiskMetadataPatch
): Record<string, string | number | boolean | null> {
  const patch: Record<string, string | number | boolean | null> = {};

  for (const field of riskMetadataPatchFields) {
    const value = input[field];
    if (value === undefined) continue;

    patch[field] = typeof value === "string" ? (cleanOptionalText(value) ?? null) : value;
  }

  return patch;
}
