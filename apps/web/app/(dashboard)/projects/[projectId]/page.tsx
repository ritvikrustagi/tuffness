import { notFound } from "next/navigation";
import { ProjectOverview } from "@/components/projects/project-overview";
import { getProjectDashboard } from "@/lib/projects/dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const dashboard = await getProjectDashboard(projectId, supabase);

  if (!dashboard) notFound();

  return <ProjectOverview dashboard={dashboard} />;
}
