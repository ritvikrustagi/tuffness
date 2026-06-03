import { createClient } from "@/lib/supabase/server";
import { RfiScanButton } from "@/components/agents/rfi-scan-button";
import { IssueList } from "@/components/issues/issue-list";
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

      <IssueList projectId={projectId} issues={(issues ?? []) as Issue[]} />
    </div>
  );
}
