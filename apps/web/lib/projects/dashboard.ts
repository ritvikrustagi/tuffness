import { summarizeIssueWorkflows } from "../issues/workflow";
import type { createClient } from "../supabase/server";
import type {
  AgentRun,
  Document,
  DocumentStatus,
  Issue,
  IssueStatus,
  RfiStatus,
  Submittal,
  SubmittalReviewStatus,
} from "../types/database";

export type DocumentReadinessSummary = {
  total: number;
  ready: number;
  in_progress: number;
  failed: number;
};

export type SubmittalReviewSummary = {
  total: number;
  pending: number;
  pass: number;
  warning: number;
  fail: number;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ProjectDashboardInput<
  TDocument extends { status: DocumentStatus },
  TIssue extends { status: IssueStatus; rfis?: Array<{ status: RfiStatus }> | null },
  TSubmittal extends { review_status: SubmittalReviewStatus },
  TAgentRun,
> = {
  projectId: string;
  documents: TDocument[];
  issues: TIssue[];
  submittals: TSubmittal[];
  agentRuns: TAgentRun[];
};

export type ProjectDashboardData<
  TDocument extends { status: DocumentStatus } = Document,
  TIssue extends { status: IssueStatus; rfis?: Array<{ status: RfiStatus }> | null } = Issue,
  TSubmittal extends { review_status: SubmittalReviewStatus } = Submittal,
  TAgentRun = AgentRun,
> = ProjectDashboardInput<TDocument, TIssue, TSubmittal, TAgentRun> & {
  documentSummary: DocumentReadinessSummary;
  issueSummary: ReturnType<typeof summarizeIssueWorkflows>;
  submittalSummary: SubmittalReviewSummary;
  recentDocuments: TDocument[];
  recentIssues: TIssue[];
  recentSubmittals: TSubmittal[];
};

export function summarizeDocuments(
  documents: Array<{ status: DocumentStatus }>
): DocumentReadinessSummary {
  return documents.reduce<DocumentReadinessSummary>(
    (summary, document) => {
      summary.total += 1;
      if (document.status === "ready") summary.ready += 1;
      if (document.status === "failed") summary.failed += 1;
      if (document.status === "pending" || document.status === "processing") {
        summary.in_progress += 1;
      }
      return summary;
    },
    { total: 0, ready: 0, in_progress: 0, failed: 0 }
  );
}

export function summarizeSubmittals(
  submittals: Array<{ review_status: SubmittalReviewStatus }>
): SubmittalReviewSummary {
  return submittals.reduce<SubmittalReviewSummary>(
    (summary, submittal) => {
      summary.total += 1;
      summary[submittal.review_status] += 1;
      return summary;
    },
    { total: 0, pending: 0, pass: 0, warning: 0, fail: 0 }
  );
}

export function buildProjectDashboard<
  TDocument extends { status: DocumentStatus },
  TIssue extends { status: IssueStatus; rfis?: Array<{ status: RfiStatus }> | null },
  TSubmittal extends { review_status: SubmittalReviewStatus },
  TAgentRun,
>({
  projectId,
  documents,
  issues,
  submittals,
  agentRuns,
}: ProjectDashboardInput<TDocument, TIssue, TSubmittal, TAgentRun>): ProjectDashboardData<
  TDocument,
  TIssue,
  TSubmittal,
  TAgentRun
> {
  return {
    projectId,
    documents,
    issues,
    submittals,
    agentRuns,
    documentSummary: summarizeDocuments(documents),
    issueSummary: summarizeIssueWorkflows(issues),
    submittalSummary: summarizeSubmittals(submittals),
    recentDocuments: documents.slice(0, 3),
    recentIssues: issues.slice(0, 3),
    recentSubmittals: submittals.slice(0, 3),
  };
}

export async function getProjectDashboard(
  projectId: string,
  supabase: SupabaseClient
): Promise<ProjectDashboardData | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;

  const [documentsResult, issuesResult, submittalsResult, agentRunsResult] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("issues")
      .select("*, rfis(*)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("submittals")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return buildProjectDashboard({
    projectId,
    documents: (documentsResult.data ?? []) as Document[],
    issues: (issuesResult.data ?? []) as Issue[],
    submittals: (submittalsResult.data ?? []) as Submittal[],
    agentRuns: (agentRunsResult.data ?? []) as AgentRun[],
  });
}
