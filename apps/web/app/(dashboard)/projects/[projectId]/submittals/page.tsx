import { createClient } from "@/lib/supabase/server";
import { SubmittalReviewSection } from "@/components/submittals/submittal-review-section";
import type { Submittal } from "@/lib/types/database";

export default async function ProjectSubmittalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: submittals } = await supabase
    .from("submittals")
    .select("*, documents(id, name, status, file_name, page_count)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <SubmittalReviewSection
      projectId={projectId}
      initialSubmittals={(submittals ?? []) as Submittal[]}
    />
  );
}
