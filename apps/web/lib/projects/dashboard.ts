import { summarizeIssueWorkflows } from "../issues/workflow";
import { summarizeRisks, type RiskSummary } from "../risks/summary";
import type { RiskLike } from "../risks/types";
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

type ProjectDashboardIssue = {
  id?: string;
  status: IssueStatus;
  rfis?: Array<{ status: RfiStatus }> | null;
  summary?: string | null;
  human_reviewed_at?: string | null;
  risk_tier?: RiskLike["risk_tier"];
  risk_score?: number | null;
  compliance_impact?: RiskLike["compliance_impact"];
  required_artifact?: RiskLike["required_artifact"];
};

export type ProjectDashboardInput<
  TDocument extends { status: DocumentStatus },
  TIssue extends ProjectDashboardIssue,
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
  TIssue extends ProjectDashboardIssue = Issue,
  TSubmittal extends { review_status: SubmittalReviewStatus } = Submittal,
  TAgentRun = AgentRun,
> = ProjectDashboardInput<TDocument, TIssue, TSubmittal, TAgentRun> & {
  documentSummary: DocumentReadinessSummary;
  issueSummary: ReturnType<typeof summarizeIssueWorkflows>;
  submittalSummary: SubmittalReviewSummary;
  riskSummary: RiskSummary;
  recentDocuments: TDocument[];
  recentIssues: TIssue[];
  recentSubmittals: TSubmittal[];
  topRisks: TIssue[];
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

function isClosedRisk(issue: ProjectDashboardIssue) {
  return issue.status === "resolved" || issue.status === "dismissed";
}

export function buildProjectDashboard<
  TDocument extends { status: DocumentStatus },
  TIssue extends ProjectDashboardIssue,
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
  const risks = issues.filter((issue) => issue.risk_tier);
  const riskSummaryInput = risks.map((risk) => ({
    ...risk,
    id: risk.human_reviewed_at ? `reviewed:${risk.id ?? ""}` : risk.id,
  }));
  const openRisks = risks.filter((risk) => !isClosedRisk(risk));

  return {
    projectId,
    documents,
    issues,
    submittals,
    agentRuns,
    documentSummary: summarizeDocuments(documents),
    issueSummary: summarizeIssueWorkflows(issues),
    submittalSummary: summarizeSubmittals(submittals),
    riskSummary: summarizeRisks(riskSummaryInput),
    recentDocuments: documents.slice(0, 3),
    recentIssues: issues.slice(0, 3),
    recentSubmittals: submittals.slice(0, 3),
    topRisks: [...openRisks].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 3),
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
