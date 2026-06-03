import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export default async function NewProjectPage({
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

  return (
    <div className="max-w-lg">
      <Link href={`/o/${orgSlug}`} className="text-sm text-orange-600 hover:underline">
        ← Back to {organization.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New project
      </h1>
      <Card className="mt-6">
        <CreateProjectForm orgId={organization.id} />
      </Card>
    </div>
  );
}
