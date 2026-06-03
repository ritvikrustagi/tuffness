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
