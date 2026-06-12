import {
  getMissingOnboardingSteps,
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/accounts/onboarding";
import { canManageOrganization, isMemberRole } from "@/lib/api/organizations";
import type { createClient } from "@/lib/supabase/server";
import type {
  AccountOnboardingEvent,
  MemberRole,
  Organization,
  OrganizationAccount,
  OrganizationInvite,
  OrganizationMember,
  Profile,
} from "@/lib/types/database";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseErrorLike = { message: string };
type SupabaseResult<T> = { data: T; error: SupabaseErrorLike | null };

export type OrganizationSettingsMember = OrganizationMember & {
  profiles?: Pick<Profile, "email" | "full_name"> | null;
};

export type OrganizationSettingsData = {
  organization: Organization;
  membership: OrganizationMember;
  account: OrganizationAccount | null;
  members: OrganizationSettingsMember[];
  invites: OrganizationInvite[];
  onboardingEvents: AccountOnboardingEvent[];
  onboarding: OnboardingProgress;
  missingOnboardingSteps: ReturnType<typeof getMissingOnboardingSteps>;
  canManage: boolean;
  assignableRolesByMemberId: Record<string, MemberRole[]>;
};

export async function unwrapSupabaseResult<T>(
  result: SupabaseResult<T>,
  context: string
): Promise<T> {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

function normalizeMemberRoles(value: unknown, context: string): MemberRole[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context}: expected role array`);
  }

  return value.map((role) => {
    if (!isMemberRole(role)) {
      throw new Error(`${context}: invalid role ${String(role)}`);
    }
    return role;
  });
}

export async function buildAssignableRolesByMemberId(
  supabase: SupabaseClient,
  organizationId: string,
  members: Pick<OrganizationMember, "id">[]
): Promise<Record<string, MemberRole[]>> {
  const entries = await Promise.all(
    members.map(async (member) => {
      const result = await supabase.rpc("get_assignable_organization_member_roles", {
        p_organization_id: organizationId,
        p_member_id: member.id,
      });
      const roles = normalizeMemberRoles(
        await unwrapSupabaseResult(
          result,
          `load assignable roles for member ${member.id}`
        ),
        `load assignable roles for member ${member.id}`
      );
      return [member.id, roles] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function getOrganizationSettingsData(
  supabase: SupabaseClient,
  orgSlug: string,
  userId: string
): Promise<OrganizationSettingsData | null> {
  const organization = await unwrapSupabaseResult(
    await supabase
      .from("organizations")
      .select("*")
      .eq("slug", orgSlug)
      .maybeSingle(),
    "load organization"
  );

  if (!organization) return null;

  const membership = await unwrapSupabaseResult(
    await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .maybeSingle(),
    "load organization membership"
  );

  if (!membership) return null;

  const [accountResult, membersResult, invitesResult, onboardingResult] =
    await Promise.all([
      supabase
        .from("organization_accounts")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle(),
      supabase
        .from("organization_members")
        .select("*, profiles(email, full_name)")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("organization_invites")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("account_onboarding_events")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
    ]);

  const account = await unwrapSupabaseResult(
    accountResult,
    "load organization account"
  );
  const members = (await unwrapSupabaseResult(
    membersResult,
    "load organization members"
  )) as OrganizationSettingsMember[];
  const invites = (await unwrapSupabaseResult(
    invitesResult,
    "load organization invites"
  )) as OrganizationInvite[];
  const onboardingEvents = (await unwrapSupabaseResult(
    onboardingResult,
    "load onboarding events"
  )) as AccountOnboardingEvent[];
  const canManage = canManageOrganization(membership.role);

  return {
    organization: organization as Organization,
    membership: membership as OrganizationMember,
    account: account as OrganizationAccount | null,
    members,
    invites,
    onboardingEvents,
    onboarding: getOnboardingProgress(onboardingEvents),
    missingOnboardingSteps: getMissingOnboardingSteps(onboardingEvents),
    canManage,
    assignableRolesByMemberId: canManage
      ? await buildAssignableRolesByMemberId(supabase, organization.id, members)
      : {},
  };
}
