import { createClient } from "@/lib/supabase/server";
import { RfiScanButton } from "@/components/agents/rfi-scan-button";
import { Card } from "@/components/ui/card";
import { IssueList } from "@/components/issues/issue-list";
import { summarizeIssueWorkflows } from "@/lib/issues/workflow";
import type { Issue } from "@/lib/types/database";

export default async function ProjectIssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: issues } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const typedIssues = (issues ?? []) as Issue[];
  const summary = summarizeIssueWorkflows(typedIssues);
  const summaryCards = [
    { label: "Open issues", value: summary.open_issues },
    { label: "Draft RFIs", value: summary.draft_rfis },
    { label: "Submitted", value: summary.submitted_rfis },
    { label: "Answered", value: summary.answered_awaiting_closeout },
    { label: "Closed", value: summary.closed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Potential RFIs
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Controlled scan using deterministic retrieval and structured LLM analysis. Results are
            drafts only — review and approve before submitting any RFI.
          </p>
        </div>
        <RfiScanButton projectId={projectId} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <IssueList projectId={projectId} issues={typedIssues} />
    </div>
  );
}
