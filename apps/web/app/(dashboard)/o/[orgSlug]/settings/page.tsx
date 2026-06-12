import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgInvites } from "@/components/organizations/org-invites";
import { OrgMembersTable } from "@/components/organizations/org-members-table";
import { OrgSettingsForm } from "@/components/organizations/org-settings-form";
import { Card } from "@/components/ui/card";
import { onboardingStepLabels } from "@/lib/accounts/schema";
import { getOrganizationSettingsData } from "@/lib/organizations/settings";
import { createClient } from "@/lib/supabase/server";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const data = await getOrganizationSettingsData(supabase, orgSlug, user.id);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/o/${orgSlug}`} className="text-sm font-medium text-orange-700 hover:text-orange-800">
        Back to organization
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {data.organization.name} settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage account profile, team access, invites, and onboarding progress.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Onboarding
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {data.onboarding.percentComplete}% complete ·{" "}
              {data.onboarding.completed.length} of{" "}
              {data.onboarding.completed.length + data.onboarding.missing.length} milestones
            </p>
          </div>
          <div className="h-2 w-40 rounded-full bg-zinc-100">
            <div
              className="h-2 rounded-full bg-orange-600"
              style={{ width: `${data.onboarding.percentComplete}%` }}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.missingOnboardingSteps.length === 0 ? (
            <p className="text-sm text-green-700">All onboarding milestones are complete.</p>
          ) : (
            data.missingOnboardingSteps.map((step) => (
              <div key={step} className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                {onboardingStepLabels[step]}
              </div>
            ))
          )}
        </div>
      </Card>

      <OrgSettingsForm
        organization={data.organization}
        account={data.account}
        canEdit={data.canManage}
      />
      <OrgMembersTable
        organizationId={data.organization.id}
        members={data.members}
        canEdit={data.canManage}
        assignableRolesByMemberId={data.assignableRolesByMemberId}
      />
      <OrgInvites
        organizationId={data.organization.id}
        invites={data.invites}
        canInvite={data.canManage}
      />
    </div>
  );
}
