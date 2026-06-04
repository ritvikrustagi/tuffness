import type { RiskFinding } from "@/lib/agents/risk/schema";
import type { MatchedChunk } from "@/lib/rag/types";

export type RiskFailureCode = "llm_timeout" | "invalid_json" | "validation_failed";

export interface RiskTopicError {
  topicLabel: string;
  message: string;
  code: RiskFailureCode;
}

function normalizeForMatch(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function evidenceItemSupported(
  evidence: RiskFinding["evidence"][number],
  chunks: MatchedChunk[]
) {
  const quote = normalizeForMatch(evidence.quote);
  if (!quote) return false;

  return chunks.some((chunk) => {
    if (chunk.document_id !== evidence.document_id) return false;
    if (chunk.page_number !== evidence.page_number) return false;
    return normalizeForMatch(chunk.content).includes(quote);
  });
}

function riskEvidenceSupported(risk: RiskFinding, chunks: MatchedChunk[]) {
  return risk.evidence.every((evidence) => evidenceItemSupported(evidence, chunks));
}

export function createRiskDedupeKey(risk: RiskFinding) {
  const evidenceKeys = risk.evidence
    .map((evidence) =>
      [
        evidence.document_id,
        evidence.page_number,
        normalizeForMatch(evidence.quote),
      ].join(":")
    )
    .sort();

  return [
    normalizeForMatch(risk.risk_category),
    normalizeForMatch(risk.summary),
    evidenceKeys.join("||"),
  ].join("|");
}

export function selectPersistableRiskFindings(params: {
  topicLabel: string;
  chunks: MatchedChunk[];
  risks: RiskFinding[];
  riskKeys: Set<string>;
  remainingSlots: number;
  maxRisksPerRun?: number;
}): { risks: RiskFinding[]; dedupeKeys: string[]; errors: RiskTopicError[] } {
  const selectedRisks: RiskFinding[] = [];
  const dedupeKeys: string[] = [];
  const errors: RiskTopicError[] = [];
  const cap = params.maxRisksPerRun ?? params.remainingSlots;

  for (const risk of params.risks) {
    if (selectedRisks.length >= params.remainingSlots) {
      errors.push({
        topicLabel: params.topicLabel,
        message: `risk cap reached; skipped remaining findings after ${cap} risks`,
        code: "validation_failed",
      });
      break;
    }

    if (!riskEvidenceSupported(risk, params.chunks)) {
      errors.push({
        topicLabel: params.topicLabel,
        message: `unsupported evidence for ${risk.summary}`,
        code: "validation_failed",
      });
      continue;
    }

    const dedupeKey = createRiskDedupeKey(risk);
    if (params.riskKeys.has(dedupeKey) || dedupeKeys.includes(dedupeKey)) {
      continue;
    }
    dedupeKeys.push(dedupeKey);
    selectedRisks.push(risk);
  }

  return { risks: selectedRisks, dedupeKeys, errors };
}
