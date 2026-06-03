import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs } from "@/components/projects/project-tabs";
import type { Organization, Project } from "@/lib/types/database";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", project.organization_id)
    .single();

  const typedProject = project as Project;
  const typedOrg = organization as Organization;

  return (
    <div>
      <Link href={`/o/${typedOrg.slug}`} className="text-sm text-orange-600 hover:underline">
        ← {typedOrg.name}
      </Link>
      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {typedProject.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {typedProject.project_number && `#${typedProject.project_number} · `}
          Manage documents and ask questions about project specs and drawings.
        </p>
      </div>

      <ProjectTabs projectId={projectId} projectName={typedProject.name} />

      <div className="mt-8">{children}</div>
    </div>
  );
}
