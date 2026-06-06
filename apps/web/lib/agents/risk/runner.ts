import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RiskAnalysisError,
  analyzeRiskTopicGroup,
} from "@/lib/agents/risk/analyze";
import { getRiskScanProfile, type RiskScanMode } from "@/lib/agents/risk/profile";
import type { RiskFinding } from "@/lib/agents/risk/schema";
import {
  createRiskDedupeKey,
  selectPersistableRiskFindings,
  type RiskFailureCode,
  type RiskSkippedFinding,
  type RiskTopicError,
} from "@/lib/agents/risk/selection";
import { retrieveTopicChunkGroups } from "@/lib/agents/rfi/topics";
import { normalizeIssueEvidence } from "@/lib/issues/workflow";
import { calculateRiskScore } from "@/lib/risks/scoring";
import type { IssueType } from "@/lib/types/database";

const MAX_RISKS_PER_RUN = 10;
export { createRiskDedupeKey };
export type { RiskFailureCode, RiskTopicError };

export interface RiskRunSummary {
  mode: RiskScanMode;
  risks_created: number;
  rfis_created: number;
  topics_analyzed: number;
  skipped_topics: number;
  errors: string[];
  skipped_findings?: string[];
  code?: RiskScanError["code"];
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
      | "db_error",
    public readonly summary?: RiskRunSummary
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
  skippedFindings: string[];
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

function summarizeErrors(errors: RiskTopicError[]) {
  return errors.map((error) => `${error.topicLabel}: ${error.message}`);
}

function summarizeSkippedFindings(skippedFindings: RiskSkippedFinding[]) {
  return skippedFindings.map((finding) => `${finding.topicLabel}: ${finding.message}`);
}

function finalFailureCode(errors: RiskTopicError[]): RiskFailureCode {
  if (errors.some((error) => error.code === "llm_timeout")) return "llm_timeout";
  if (errors.length > 0 && errors.every((error) => error.code === "validation_failed")) {
    return "validation_failed";
  }
  return "invalid_json";
}

export function buildRiskRunSummary(params: {
  mode?: RiskScanMode;
  risksCreated: number;
  rfisCreated: number;
  topicsAnalyzed: number;
  skippedTopics: number;
  errors: RiskTopicError[];
  skippedFindings?: RiskSkippedFinding[];
  code?: RiskScanError["code"];
}): RiskRunSummary {
  const skippedFindings = summarizeSkippedFindings(params.skippedFindings ?? []);

  return {
    mode: params.mode ?? "risk_register_scan",
    risks_created: params.risksCreated,
    rfis_created: params.rfisCreated,
    topics_analyzed: params.topicsAnalyzed,
    skipped_topics: params.skippedTopics,
    errors: summarizeErrors(params.errors),
    ...(skippedFindings.length ? { skipped_findings: skippedFindings } : {}),
    ...(params.code ? { code: params.code } : {}),
  };
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
  const { error } = await supabase.rpc(
    "create_risk_issue_with_optional_rfi",
    buildRiskIssueRpcParams(params)
  );

  if (error) {
    throw new RiskScanError(error.message, "db_error");
  }

  return { rfiCreated: params.risk.required_artifact === "rfi" };
}

export function buildRiskIssueRpcParams(params: {
  projectId: string;
  organizationId: string;
  agentRunId: string;
  userId: string;
  risk: RiskFinding;
}) {
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

  return {
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
  };
}

export async function runRiskScan(params: {
  supabase: SupabaseClient;
  projectId: string;
  organizationId: string;
  agentRunId: string;
  userId: string;
  mode?: RiskScanMode;
}): Promise<RiskScanResult> {
  const {
    supabase,
    projectId,
    organizationId,
    agentRunId,
    userId,
    mode = "risk_register_scan",
  } = params;
  const scanProfile = getRiskScanProfile(mode);

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
  const skippedFindings: RiskSkippedFinding[] = [];
  const riskKeys = new Set<string>();

  for (let index = 0; index < topicGroups.length; index += 1) {
    if (risksCreated >= MAX_RISKS_PER_RUN) {
      skippedTopics += topicGroups.length - index;
      break;
    }

    const group = topicGroups[index];
    topicsAnalyzed += 1;

    try {
      const output = await analyzeRiskTopicGroup(group.topic, group.chunks, mode);

      if (output.risks.length === 0) {
        skippedTopics += 1;
        continue;
      }

      const selected = selectPersistableRiskFindings({
        topicLabel: group.topic.label,
        chunks: group.chunks,
        risks: output.risks,
        riskKeys,
        remainingSlots: MAX_RISKS_PER_RUN - risksCreated,
        maxRisksPerRun: MAX_RISKS_PER_RUN,
        scanProfile,
      });
      errors.push(...selected.errors);
      skippedFindings.push(...selected.skippedFindings);
      for (const dedupeKey of selected.dedupeKeys) {
        riskKeys.add(dedupeKey);
      }

      for (const risk of selected.risks) {
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
    const code = finalFailureCode(errors);
    const summary = buildRiskRunSummary({
      risksCreated,
      rfisCreated,
      topicsAnalyzed,
      skippedTopics,
      errors,
      skippedFindings,
      code,
      mode,
    });
    throw new RiskScanError(
      summary.errors[0] ?? "All topic analyses failed",
      code,
      summary
    );
  }

  const summary = buildRiskRunSummary({
    risksCreated,
    rfisCreated,
    topicsAnalyzed,
    skippedTopics,
    errors,
    skippedFindings,
    mode,
  });

  await updateAgentRun(supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output_summary: summary,
  });

  return {
    risksCreated,
    rfisCreated,
    topicsAnalyzed,
    skippedTopics,
    errors: summary.errors,
    skippedFindings: summary.skipped_findings ?? [],
  };
}

export async function failRiskAgentRun(
  supabase: SupabaseClient,
  agentRunId: string,
  error: RiskScanError
) {
  const outputSummary: RiskRunSummary = {
    mode: error.summary?.mode ?? "risk_register_scan",
    risks_created: 0,
    rfis_created: 0,
    topics_analyzed: 0,
    skipped_topics: 0,
    errors: [error.message],
    ...error.summary,
    code: error.code,
  };

  const { error: updateError } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error.message,
      output_summary: outputSummary,
    })
    .eq("id", agentRunId);

  if (updateError) {
    throw new RiskScanError(updateError.message, "db_error");
  }
}
