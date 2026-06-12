import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canManageOrganization } from "@/lib/api/organizations";
import type { Project } from "@/lib/types/database";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (!organization) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organization.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div>
      <Link href="/" className="text-sm text-orange-600 hover:underline">
        ← All organizations
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Projects</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageOrganization(membership?.role) && (
            <Link href={`/o/${orgSlug}/settings`}>
              <Button variant="secondary">Settings</Button>
            </Link>
          )}
          <Link href={`/o/${orgSlug}/projects/new`}>
            <Button>New project</Button>
          </Link>
        </div>
      </div>

      {(projects ?? []).length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No projects yet. Create one to start uploading documents.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(projects as Project[]).map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition hover:border-orange-300 hover:shadow-md">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {project.name}
                </h2>
                {project.project_number && (
                  <p className="mt-1 text-sm text-zinc-500">#{project.project_number}</p>
                )}
                {project.address && (
                  <p className="mt-1 text-sm text-zinc-500">{project.address}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
