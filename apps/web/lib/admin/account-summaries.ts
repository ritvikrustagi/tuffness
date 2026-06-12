import {
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/accounts/onboarding";
import type { createClient } from "@/lib/supabase/server";
import type {
  AccountPlan,
  AccountStatus,
  CompanyType,
  Organization,
  OrganizationAccount,
} from "@/lib/types/database";
import {
  buildAccountHealthSummary,
  type AccountHealthCounts,
  type AccountHealthSummary,
} from "./account-health-core";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AdminAccountSummary = {
  organization: Organization;
  account: OrganizationAccount | null;
  counts: AccountHealthCounts;
  health: AccountHealthSummary;
  onboarding: OnboardingProgress;
};

export type AdminAccountListFilters = {
  search?: string | null;
  status?: AccountStatus | "all" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type AdminAccountListResult = {
  accounts: AdminAccountSummary[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export type PlatformAccountSummaryRow = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  organization_created_at: string;
  organization_updated_at: string;
  account_status: AccountStatus | null;
  account_plan: AccountPlan | null;
  account_company_type: CompanyType | null;
  account_website: string | null;
  account_primary_contact_name: string | null;
  account_primary_contact_email: string | null;
  account_billing_contact_email: string | null;
  account_created_at: string | null;
  account_updated_at: string | null;
  project_count: number | string | null;
  member_count: number | string | null;
  documents_processed: number | string | null;
  pages_processed: number | string | null;
  ai_run_count: number | string | null;
  failed_ai_run_count: number | string | null;
  open_high_risk_count: number | string | null;
  open_rfi_count: number | string | null;
  submittals_needing_review_count: number | string | null;
  last_activity_at: string | null;
  onboarding_event_types: string[] | null;
};

function numericCount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function organizationFromSummaryRow(row: PlatformAccountSummaryRow): Organization {
  return {
    id: row.organization_id,
    name: row.organization_name,
    slug: row.organization_slug,
    created_at: row.organization_created_at,
    updated_at: row.organization_updated_at,
  };
}

function accountFromSummaryRow(row: PlatformAccountSummaryRow): OrganizationAccount | null {
  if (!row.account_status || !row.account_plan || !row.account_company_type) return null;

  return {
    organization_id: row.organization_id,
    status: row.account_status,
    plan: row.account_plan,
    company_type: row.account_company_type,
    website: row.account_website,
    primary_contact_name: row.account_primary_contact_name,
    primary_contact_email: row.account_primary_contact_email,
    billing_contact_email: row.account_billing_contact_email,
    created_at: row.account_created_at ?? row.organization_created_at,
    updated_at: row.account_updated_at ?? row.organization_updated_at,
  };
}

export function buildAdminAccountSummaryFromPlatformRow(
  row: PlatformAccountSummaryRow
): AdminAccountSummary {
  const counts: AccountHealthCounts = {
    projectCount: numericCount(row.project_count),
    memberCount: numericCount(row.member_count),
    documentsProcessed: numericCount(row.documents_processed),
    pagesProcessed: numericCount(row.pages_processed),
    aiRunCount: numericCount(row.ai_run_count),
    failedAiRunCount: numericCount(row.failed_ai_run_count),
    openHighRiskCount: numericCount(row.open_high_risk_count),
    openRfiCount: numericCount(row.open_rfi_count),
    submittalsNeedingReviewCount: numericCount(row.submittals_needing_review_count),
    lastActivityAt: row.last_activity_at,
  };

  return {
    organization: organizationFromSummaryRow(row),
    account: accountFromSummaryRow(row),
    counts,
    health: buildAccountHealthSummary(counts),
    onboarding: getOnboardingProgress(
      (row.onboarding_event_types ?? []).map((event_type) => ({ event_type }))
    ),
  };
}

function normalizeAdminListFilters(filters: AdminAccountListFilters = {}) {
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 50, 100));
  const page = Math.max(1, filters.page ?? 1);
  const search = filters.search?.trim() || null;
  const status = filters.status && filters.status !== "all" ? filters.status : null;

  return {
    search,
    status,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export async function listAdminAccountSummaries(
  supabase: SupabaseClient,
  filters: AdminAccountListFilters = {}
): Promise<AdminAccountListResult> {
  const normalized = normalizeAdminListFilters(filters);
  const countParams = {
    p_organization_id: null,
    p_search: normalized.search,
    p_status: normalized.status,
  };
  const [countResult, rowsResult] = await Promise.all([
    supabase.rpc("get_platform_account_summary_count", countParams),
    supabase.rpc("get_platform_account_summaries", {
      ...countParams,
      p_limit: normalized.pageSize,
      p_offset: normalized.offset,
    }),
  ]);

  if (countResult.error) throw new Error(countResult.error.message);
  if (rowsResult.error) throw new Error(rowsResult.error.message);

  const rows = (rowsResult.data ?? []) as PlatformAccountSummaryRow[];
  const totalCount = numericCount(countResult.data as number | string | null);

  return {
    accounts: rows.map(buildAdminAccountSummaryFromPlatformRow),
    pagination: {
      page: normalized.page,
      pageSize: normalized.pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / normalized.pageSize)),
    },
  };
}
