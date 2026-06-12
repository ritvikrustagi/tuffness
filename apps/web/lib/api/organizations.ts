import type { MemberRole, Organization, OrganizationWithRole } from "@/lib/types/database";

type MembershipRow = {
  role: MemberRole;
  organizations: Organization | Organization[] | null;
};

export function mapMemberships(
  rows: MembershipRow[] | null | undefined
): OrganizationWithRole[] {
  return (rows ?? []).flatMap((row) => {
    const org = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;
    if (!org) return [];
    return [{ ...org, role: row.role }];
  });
}

const roleRank: Record<MemberRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export const memberRoles = ["owner", "admin", "member", "viewer"] as const satisfies readonly MemberRole[];

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && memberRoles.includes(value as MemberRole);
}

export function canManageOrganization(role: MemberRole | null | undefined) {
  return role === "owner" || role === "admin";
}

export function isRoleAtLeast(role: MemberRole, minimum: MemberRole) {
  return roleRank[role] >= roleRank[minimum];
}
