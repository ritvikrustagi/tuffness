import type {
  AccountPlan,
  AccountStatus,
  CompanyType,
  InviteStatus,
  MemberRole,
} from "@/lib/types/database";

export const accountStatuses = ["trial", "active", "paused", "churned"] as const satisfies readonly AccountStatus[];
export const accountPlans = ["starter", "growth", "enterprise", "internal"] as const satisfies readonly AccountPlan[];
export const companyTypes = [
  "general_contractor",
  "subcontractor",
  "owner",
  "architect",
  "consultant",
  "other",
] as const satisfies readonly CompanyType[];
export const inviteStatuses = ["pending", "accepted", "revoked", "expired"] as const satisfies readonly InviteStatus[];
export const inviteRoles = ["admin", "member", "viewer"] as const satisfies readonly MemberRole[];

export const onboardingSteps = [
  "organization_profile_completed",
  "first_project_created",
  "first_document_uploaded",
  "first_risk_scan_completed",
  "first_packet_exported",
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number];

export const onboardingStepLabels: Record<OnboardingStepId, string> = {
  organization_profile_completed: "Organization profile completed",
  first_project_created: "First project created",
  first_document_uploaded: "First document uploaded",
  first_risk_scan_completed: "First risk scan completed",
  first_packet_exported: "First packet exported",
};

export function isAccountStatus(value: string): value is AccountStatus {
  return accountStatuses.includes(value as AccountStatus);
}

export function isAccountPlan(value: string): value is AccountPlan {
  return accountPlans.includes(value as AccountPlan);
}

export function isCompanyType(value: string): value is CompanyType {
  return companyTypes.includes(value as CompanyType);
}

export function isInviteRole(value: string): value is (typeof inviteRoles)[number] {
  return inviteRoles.includes(value as (typeof inviteRoles)[number]);
}

export function isOnboardingStep(value: string): value is OnboardingStepId {
  return onboardingSteps.includes(value as OnboardingStepId);
}
