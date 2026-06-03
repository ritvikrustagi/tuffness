import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectDocuments } from "@/components/documents/project-documents";
import type { Document } from "@/lib/types/database";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <ProjectDocuments
      projectId={projectId}
      initialDocuments={(documents ?? []) as Document[]}
    />
  );
}
