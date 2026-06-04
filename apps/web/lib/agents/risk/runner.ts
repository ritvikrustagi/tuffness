import type { SupabaseClient } from "@supabase/supabase-js";
import { RiskAnalysisError, analyzeRiskTopicGroup } from "@/lib/agents/risk/analyze";
import type { RiskFinding } from "@/lib/agents/risk/schema";
import { retrieveTopicChunkGroups } from "@/lib/agents/rfi/topics";
import { normalizeIssueEvidence } from "@/lib/issues/workflow";
import type { MatchedChunk } from "@/lib/rag/types";
import { calculateRiskScore } from "@/lib/risks/scoring";
import type { IssueType } from "@/lib/types/database";

const MAX_RISKS_PER_RUN = 10;

type RiskFailureCode = "llm_timeout" | "invalid_json" | "validation_failed";

interface RiskTopicError {
  topicLabel: string;
  message: string;
  code: RiskFailureCode;
}

export class RiskScanError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "no_documents"
      | "no_chunks"
      | "llm_timeout"
      | "invalid_json"
      | "validation_failed"
      | "db_error"
  ) {
    super(message);
    this.name = "RiskScanError";
  }
}

export interface RiskScanResult {
  risksCreated: number;
  rfisCreated: number;
  topicsAnalyzed: number;
  skippedTopics: number;
  errors: string[];
}

async function updateAgentRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from("agent_runs").update(patch).eq("id", runId);
  if (error) throw new RiskScanError(error.message, "db_error");
}

function mapRiskCategoryToIssueType(risk: RiskFinding): IssueType {
  if (risk.risk_category === "drawing_spec_conflict") return "drawing_spec_conflict";
  if (risk.risk_category === "missing_information") return "missing_info";
  if (risk.risk_category === "coordination_conflict") return "coordination";
  return "other";
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

function riskDedupeKey(risk: RiskFinding) {
  const firstEvidence = risk.evidence[0];
  return [
    normalizeForMatch(risk.risk_category),
    normalizeForMatch(risk.summary),
    firstEvidence.document_id,
    firstEvidence.page_number,
    normalizeForMatch(firstEvidence.quote),
  ].join("|");
}

function summarizeErrors(errors: RiskTopicError[]) {
  return errors.map((error) => `${error.topicLabel}: ${error.message}`);
}

function finalFailureCode(errors: RiskTopicError[]): RiskFailureCode {
  if (errors.some((error) => error.code === "llm_timeout")) return "llm_timeout";
  if (errors.length > 0 && errors.every((error) => error.code === "validation_failed")) {
    return "validation_failed";
  }
  return "invalid_json";
}

async function persistRiskFinding(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    organizationId: string;
    agentRunId: string;
    userId: string;
    risk: RiskFinding;
  }
): Promise<{ rfiCreated: boolean }> {
  const evidence = normalizeIssueEvidence(params.risk.evidence);
  const { risk_score, risk_tier } = calculateRiskScore({
    severity: params.risk.severity,
    cost_impact: params.risk.cost_impact,
    schedule_impact: params.risk.schedule_impact,
    compliance_impact: params.risk.compliance_impact,
    confidence: params.risk.confidence,
    evidence_count: evidence.length,
    blocks_work: Boolean(params.risk.blocked_activity),
  });
  const { error } = await supabase.rpc("create_risk_issue_with_optional_rfi", {
    p_project_id: params.projectId,
    p_organization_id: params.organizationId,
    p_agent_run_id: params.agentRunId,
    p_user_id: params.userId,
    p_issue_type: mapRiskCategoryToIssueType(params.risk),
    p_severity: params.risk.severity,
    p_summary: params.risk.summary,
    p_description: params.risk.description,
    p_evidence: evidence,
    p_draft_rfi: params.risk.draft_rfi ?? null,
    p_confidence: params.risk.confidence,
    p_trade: params.risk.responsible_trade ?? null,
    p_recommended_action: params.risk.recommended_action,
    p_risk_category: params.risk.risk_category,
    p_risk_score: risk_score,
    p_risk_tier: risk_tier,
    p_cost_impact: params.risk.cost_impact,
    p_schedule_impact: params.risk.schedule_impact,
    p_compliance_impact: params.risk.compliance_impact,
    p_responsible_party: params.risk.responsible_party ?? null,
    p_responsible_trade: params.risk.responsible_trade ?? null,
    p_spec_section: params.risk.spec_section ?? null,
    p_drawing_sheet: params.risk.drawing_sheet ?? null,
    p_required_artifact: params.risk.required_artifact,
    p_blocked_activity: params.risk.blocked_activity ?? null,
    p_risk_reasoning: params.risk.description,
    p_evidence_strength: params.risk.evidence_strength,
  });

  if (error) {
    throw new RiskScanError(error.message, "db_error");
  }

  return { rfiCreated: params.risk.required_artifact === "rfi" };
}

export async function runRiskScan(params: {
  supabase: SupabaseClient;
  projectId: string;
  organizationId: string;
  agentRunId: string;
  userId: string;
}): Promise<RiskScanResult> {
  const { supabase, projectId, organizationId, agentRunId, userId } = params;

  await updateAgentRun(supabase, agentRunId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  const { data: readyDocs, error: docsError } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "ready");

  if (docsError) {
    throw new RiskScanError(docsError.message, "db_error");
  }

  if (!readyDocs?.length) {
    throw new RiskScanError("No processed documents available for this project.", "no_documents");
  }

  const topicGroups = await retrieveTopicChunkGroups(supabase, projectId);

  if (topicGroups.length === 0) {
    throw new RiskScanError("No document chunks found for analysis.", "no_chunks");
  }

  let risksCreated = 0;
  let rfisCreated = 0;
  let skippedTopics = 0;
  let topicsAnalyzed = 0;
  const errors: RiskTopicError[] = [];
  const riskKeys = new Set<string>();

  for (let index = 0; index < topicGroups.length; index += 1) {
    if (risksCreated >= MAX_RISKS_PER_RUN) {
      skippedTopics += topicGroups.length - index;
      break;
    }

    const group = topicGroups[index];
    topicsAnalyzed += 1;

    try {
      const output = await analyzeRiskTopicGroup(group.topic, group.chunks);

      if (output.risks.length === 0) {
        skippedTopics += 1;
        continue;
      }

      for (const risk of output.risks) {
        if (risksCreated >= MAX_RISKS_PER_RUN) {
          errors.push({
            topicLabel: group.topic.label,
            message: `risk cap reached; skipped remaining findings after ${MAX_RISKS_PER_RUN} risks`,
            code: "validation_failed",
          });
          break;
        }

        if (!riskEvidenceSupported(risk, group.chunks)) {
          errors.push({
            topicLabel: group.topic.label,
            message: `unsupported evidence for ${risk.summary}`,
            code: "validation_failed",
          });
          continue;
        }

        const dedupeKey = riskDedupeKey(risk);
        if (riskKeys.has(dedupeKey)) {
          continue;
        }
        riskKeys.add(dedupeKey);

        const result = await persistRiskFinding(supabase, {
          projectId,
          organizationId,
          agentRunId,
          userId,
          risk,
        });
        risksCreated += 1;
        if (result.rfiCreated) rfisCreated += 1;
      }
    } catch (err) {
      if (err instanceof RiskAnalysisError) {
        errors.push({
          topicLabel: group.topic.label,
          message: err.message,
          code: err.code,
        });
        skippedTopics += 1;
        continue;
      }
      throw err;
    }
  }

  if (risksCreated === 0 && errors.length >= topicsAnalyzed && topicsAnalyzed > 0) {
    throw new RiskScanError(
      summarizeErrors(errors)[0] ?? "All topic analyses failed",
      finalFailureCode(errors)
    );
  }

  await updateAgentRun(supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output_summary: {
      risks_created: risksCreated,
      rfis_created: rfisCreated,
      topics_analyzed: topicsAnalyzed,
      skipped_topics: skippedTopics,
      errors: summarizeErrors(errors),
    },
  });

  return {
    risksCreated,
    rfisCreated,
    topicsAnalyzed,
    skippedTopics,
    errors: summarizeErrors(errors),
  };
}

export async function failRiskAgentRun(
  supabase: SupabaseClient,
  agentRunId: string,
  error: RiskScanError
) {
  const { error: updateError } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error.message,
      output_summary: { code: error.code },
    })
    .eq("id", agentRunId);

  if (updateError) {
    throw new RiskScanError(updateError.message, "db_error");
  }
}
