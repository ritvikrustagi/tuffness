import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeTopicGroup, RfiAnalysisError } from "@/lib/agents/rfi/analyze";
import type { RfiAgentIssue } from "@/lib/agents/rfi/schema";
import { retrieveTopicChunkGroups } from "@/lib/agents/rfi/topics";

export class RfiScanError extends Error {
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
    this.name = "RfiScanError";
  }
}

export interface RfiScanResult {
  issuesCreated: number;
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
  if (error) throw new RfiScanError(error.message, "db_error");
}

async function persistIssueWithRfi(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    organizationId: string;
    agentRunId: string;
    userId: string;
    issue: RfiAgentIssue;
    topicLabel: string;
  }
): Promise<void> {
  const evidence = params.issue.evidence.map((item) => ({
    document_id: item.document_id,
    document_name: item.document_name,
    page_number: item.page_number,
    excerpt: item.quote,
  }));

  const { data: issueRow, error: issueError } = await supabase
    .from("issues")
    .insert({
      project_id: params.projectId,
      organization_id: params.organizationId,
      agent_run_id: params.agentRunId,
      issue_type: params.issue.issue_type,
      severity: params.issue.severity,
      status: "open",
      summary: params.issue.summary,
      description: `Detected during RFI scan (${params.topicLabel}). Pending human review.`,
      evidence,
      draft_rfi: params.issue.draft_rfi,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (issueError || !issueRow) {
    throw new RfiScanError(issueError?.message ?? "Failed to insert issue", "db_error");
  }

  const { error: rfiError } = await supabase.from("rfis").insert({
    project_id: params.projectId,
    organization_id: params.organizationId,
    issue_id: issueRow.id,
    subject: params.issue.summary.slice(0, 200),
    question: params.issue.draft_rfi,
    status: "draft",
    created_by: params.userId,
  });

  if (rfiError) {
    throw new RfiScanError(rfiError.message, "db_error");
  }
}

export async function runRfiScan(params: {
  supabase: SupabaseClient;
  projectId: string;
  organizationId: string;
  agentRunId: string;
  userId: string;
}): Promise<RfiScanResult> {
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
    throw new RfiScanError(docsError.message, "db_error");
  }

  if (!readyDocs?.length) {
    throw new RfiScanError("No processed documents available for this project.", "no_documents");
  }

  const topicGroups = await retrieveTopicChunkGroups(supabase, projectId);

  if (topicGroups.length === 0) {
    throw new RfiScanError("No document chunks found for analysis.", "no_chunks");
  }

  let issuesCreated = 0;
  let rfisCreated = 0;
  let skippedTopics = 0;
  const errors: string[] = [];

  for (const group of topicGroups) {
    try {
      const output = await analyzeTopicGroup(group.topic, group.chunks);

      if (output.issues.length === 0) {
        skippedTopics += 1;
        continue;
      }

      for (const issue of output.issues) {
        await persistIssueWithRfi(supabase, {
          projectId,
          organizationId,
          agentRunId,
          userId,
          issue,
          topicLabel: group.topic.label,
        });
        issuesCreated += 1;
        rfisCreated += 1;
      }
    } catch (err) {
      if (err instanceof RfiAnalysisError) {
        errors.push(`${group.topic.label}: ${err.message}`);
        skippedTopics += 1;
        continue;
      }
      throw err;
    }
  }

  if (issuesCreated === 0 && errors.length === topicGroups.length) {
    const hasTimeout = errors.some((e) => e.includes("timed out"));
    throw new RfiScanError(
      errors[0] ?? "All topic analyses failed",
      hasTimeout ? "llm_timeout" : "invalid_json"
    );
  }

  await updateAgentRun(supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output_summary: {
      issues_created: issuesCreated,
      rfis_created: rfisCreated,
      topics_analyzed: topicGroups.length,
      skipped_topics: skippedTopics,
      errors,
    },
  });

  return {
    issuesCreated,
    rfisCreated,
    topicsAnalyzed: topicGroups.length,
    skippedTopics,
    errors,
  };
}

export async function failAgentRun(
  supabase: SupabaseClient,
  agentRunId: string,
  error: RfiScanError
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
