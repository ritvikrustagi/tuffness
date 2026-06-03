import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeSubmittalReview, SubmittalAnalysisError } from "@/lib/agents/submittal/analyze";
import { retrieveReviewContext } from "@/lib/agents/submittal/retrieval";
import {
  mapOverallStatusToReviewStatus,
  type SubmittalCategory,
  type SubmittalReviewItem,
  type SubmittalReviewOutput,
} from "@/lib/agents/submittal/schema";

export class SubmittalReviewError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "no_submittal"
      | "not_processed"
      | "no_spec_documents"
      | "no_spec_chunks"
      | "no_submittal_chunks"
      | "llm_timeout"
      | "invalid_json"
      | "validation_failed"
      | "db_error"
  ) {
    super(message);
    this.name = "SubmittalReviewError";
  }
}

function mapRetrievalError(message: string): SubmittalReviewError {
  if (message.includes("No specification documents")) {
    return new SubmittalReviewError(message, "no_spec_documents");
  }
  if (message.includes("No relevant specification chunks")) {
    return new SubmittalReviewError(message, "no_spec_chunks");
  }
  if (message.includes("No processed submittal chunks")) {
    return new SubmittalReviewError(message, "no_submittal_chunks");
  }
  return new SubmittalReviewError(message, "db_error");
}

async function updateAgentRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from("agent_runs").update(patch).eq("id", runId);
  if (error) throw new SubmittalReviewError(error.message, "db_error");
}

async function createIssueForItem(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    organizationId: string;
    submittalId: string;
    agentRunId: string;
    userId: string;
    item: SubmittalReviewItem;
  }
) {
  const evidence = params.item.evidence.map((ev) => ({
    document_id: ev.document_id,
    document_name: ev.document_name,
    page_number: ev.page_number,
    excerpt: ev.quote,
    source: ev.source,
  }));

  const { error } = await supabase.from("issues").insert({
    project_id: params.projectId,
    organization_id: params.organizationId,
    submittal_id: params.submittalId,
    agent_run_id: params.agentRunId,
    issue_type: "other",
    severity: params.item.severity,
    status: "open",
    summary: `Submittal review: ${params.item.requirement.slice(0, 200)}`,
    description: params.item.recommendation,
    evidence,
    draft_rfi: null,
    created_by: params.userId,
  });

  if (error) {
    throw new SubmittalReviewError(error.message, "db_error");
  }
}

export async function runSubmittalReview(params: {
  supabase: SupabaseClient;
  projectId: string;
  submittalId: string;
  agentRunId: string;
  userId: string;
}): Promise<{ review: SubmittalReviewOutput; issuesCreated: number }> {
  const { supabase, projectId, submittalId, agentRunId, userId } = params;

  await updateAgentRun(supabase, agentRunId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  const { data: submittal, error: submittalError } = await supabase
    .from("submittals")
    .select("*, documents(*)")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (submittalError) {
    throw new SubmittalReviewError(submittalError.message, "db_error");
  }

  if (!submittal) {
    throw new SubmittalReviewError("Submittal not found.", "no_submittal");
  }

  if (!submittal.document_id) {
    throw new SubmittalReviewError("Submittal has no uploaded document.", "no_submittal");
  }

  const document = submittal.documents as { status?: string; name?: string } | null;
  if (!document || document.status !== "ready") {
    throw new SubmittalReviewError(
      "Submittal document is not processed yet. Wait for processing to complete.",
      "not_processed"
    );
  }

  let context;
  try {
    context = await retrieveReviewContext(supabase, {
      projectId,
      submittalDocumentId: submittal.document_id,
      category: (submittal.category as SubmittalCategory | null) ?? null,
      submittalTitle: submittal.title,
    });
  } catch (err) {
    throw mapRetrievalError(err instanceof Error ? err.message : "Retrieval failed");
  }

  let review: SubmittalReviewOutput;
  try {
    review = await analyzeSubmittalReview({
      submittalTitle: submittal.title,
      category: (submittal.category as SubmittalCategory | null) ?? null,
      context,
    });
  } catch (err) {
    if (err instanceof SubmittalAnalysisError) {
      throw new SubmittalReviewError(err.message, err.code);
    }
    throw err;
  }

  const reviewStatus = mapOverallStatusToReviewStatus(review.overall_status);
  let issuesCreated = 0;

  for (const item of review.items) {
    if (item.status === "fail" || (item.status === "warning" && item.severity === "high")) {
      await createIssueForItem(supabase, {
        projectId,
        organizationId: submittal.organization_id,
        submittalId,
        agentRunId,
        userId,
        item,
      });
      issuesCreated += 1;
    }
  }

  const { error: updateError } = await supabase
    .from("submittals")
    .update({
      review_status: reviewStatus,
      review_summary: review.summary,
      review_findings: review.items,
      review_result: review,
      reviewed_at: new Date().toISOString(),
      agent_run_id: agentRunId,
    })
    .eq("id", submittalId);

  if (updateError) {
    throw new SubmittalReviewError(updateError.message, "db_error");
  }

  await updateAgentRun(supabase, agentRunId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    output_summary: {
      overall_status: review.overall_status,
      review_status: reviewStatus,
      items_count: review.items.length,
      issues_created: issuesCreated,
    },
  });

  return { review, issuesCreated };
}

export async function failSubmittalReviewRun(
  supabase: SupabaseClient,
  agentRunId: string,
  error: SubmittalReviewError
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
