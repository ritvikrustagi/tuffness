import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapMemberships } from "@/lib/api/organizations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .order("created_at", { ascending: false });

  const organizations = mapMemberships(memberships);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Select an organization or create a new one.
          </p>
        </div>
        <Link href="/organizations/new">
          <Button>New organization</Button>
        </Link>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You are not a member of any organization yet.
          </p>
          <Link href="/organizations/new" className="mt-4 inline-block">
            <Button>Create your first organization</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/o/${org.slug}`}>
              <Card className="transition hover:border-orange-300 hover:shadow-md">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{org.name}</h2>
                <p className="mt-1 text-sm capitalize text-zinc-500">{org.role}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
