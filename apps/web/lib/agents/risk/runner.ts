import type { SupabaseClient } from "@supabase/supabase-js";
import { RiskAnalysisError, analyzeRiskTopicGroup } from "@/lib/agents/risk/analyze";
import type { RiskFinding } from "@/lib/agents/risk/schema";
import { retrieveTopicChunkGroups } from "@/lib/agents/rfi/topics";
import { normalizeIssueEvidence } from "@/lib/issues/workflow";
import { calculateRiskScore } from "@/lib/risks/scoring";
import type { IssueType } from "@/lib/types/database";

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

async function persistRiskFinding(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    organizationId: string;
    agentRunId: string;
    userId: string;
    risk: RiskFinding;
    topicLabel: string;
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
  const status = params.risk.draft_rfi ? "draft_rfi" : "open";

  const { data: issueRow, error: issueError } = await supabase
    .from("issues")
    .insert({
      project_id: params.projectId,
      organization_id: params.organizationId,
      agent_run_id: params.agentRunId,
      issue_type: mapRiskCategoryToIssueType(params.risk),
      severity: params.risk.severity,
      status,
      summary: params.risk.summary,
      description:
        params.risk.description ??
        `Detected during risk scan (${params.topicLabel}). Pending human review.`,
      evidence,
      draft_rfi: params.risk.draft_rfi ?? null,
      confidence: params.risk.confidence,
      trade: params.risk.responsible_trade ?? null,
      recommended_action: params.risk.recommended_action,
      risk_category: params.risk.risk_category,
      risk_score,
      risk_tier,
      cost_impact: params.risk.cost_impact,
      schedule_impact: params.risk.schedule_impact,
      compliance_impact: params.risk.compliance_impact,
      responsible_party: params.risk.responsible_party ?? null,
      responsible_trade: params.risk.responsible_trade ?? null,
      spec_section: params.risk.spec_section ?? null,
      drawing_sheet: params.risk.drawing_sheet ?? null,
      required_artifact: params.risk.required_artifact,
      blocked_activity: params.risk.blocked_activity ?? null,
      risk_reasoning: params.risk.description,
      evidence_strength: params.risk.evidence_strength,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (issueError || !issueRow) {
    throw new RiskScanError(issueError?.message ?? "Failed to insert risk issue", "db_error");
  }

  if (!params.risk.draft_rfi) {
    return { rfiCreated: false };
  }

  const { error: rfiError } = await supabase.from("rfis").insert({
    project_id: params.projectId,
    organization_id: params.organizationId,
    issue_id: issueRow.id,
    subject: params.risk.summary.slice(0, 200),
    question: params.risk.draft_rfi,
    status: "draft",
    created_by: params.userId,
  });

  if (rfiError) {
    throw new RiskScanError(rfiError.message, "db_error");
  }

  return { rfiCreated: true };
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
  const errors: string[] = [];

  for (const group of topicGroups) {
    try {
      const output = await analyzeRiskTopicGroup(group.topic, group.chunks);

      if (output.risks.length === 0) {
        skippedTopics += 1;
        continue;
      }

      for (const risk of output.risks) {
        const result = await persistRiskFinding(supabase, {
          projectId,
          organizationId,
          agentRunId,
          userId,
          risk,
          topicLabel: group.topic.label,
        });
        risksCreated += 1;
        if (result.rfiCreated) rfisCreated += 1;
      }
    } catch (err) {
      if (err instanceof RiskAnalysisError) {
        errors.push(`${group.topic.label}: ${err.message}`);
        skippedTopics += 1;
        continue;
      }
      throw err;
    }
  }

  if (risksCreated === 0 && errors.length === topicGroups.length) {
    const hasTimeout = errors.some((e) => e.includes("timed out"));
    throw new RiskScanError(
      errors[0] ?? "All topic analyses failed",
      hasTimeout ? "llm_timeout" : "invalid_json"
    );
  }

  await updateAgentRun(supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output_summary: {
      risks_created: risksCreated,
      rfis_created: rfisCreated,
      topics_analyzed: topicGroups.length,
      skipped_topics: skippedTopics,
      errors,
    },
  });

  return {
    risksCreated,
    rfisCreated,
    topicsAnalyzed: topicGroups.length,
    skippedTopics,
    errors,
  };
}

export async function failRiskAgentRun(
  supabase: SupabaseClient,
  agentRunId: string,
  error: RiskScanError
) {
  await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error.message,
      output_summary: { code: error.code },
    })
    .eq("id", agentRunId);
}
