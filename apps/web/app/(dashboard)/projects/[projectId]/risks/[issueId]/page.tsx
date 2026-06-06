import { notFound } from "next/navigation";
import { RiskDetailWorkspace } from "@/components/risks/risk-detail-workspace";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types/database";

export default async function ProjectRiskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = await params;
  const supabase = await createClient();

  const { data: issue, error } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .eq("id", issueId)
    .not("risk_tier", "is", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!issue) notFound();

  return <RiskDetailWorkspace projectId={projectId} initialIssue={issue as Issue} />;
}
