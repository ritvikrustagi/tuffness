import { describe, expect, test } from "vitest";
import { getAdminAccountDetail } from "./account-detail";
import { buildAccountHealthSummary } from "./account-health-core";
import {
  buildAdminAccountSummaryFromPlatformRow,
  listAdminAccountSummaries,
  type PlatformAccountSummaryRow,
} from "./account-summaries";

describe("admin account health", () => {
  test("marks accounts with open high-risk work as needing attention", () => {
    const summary = buildAccountHealthSummary({
      projectCount: 3,
      memberCount: 9,
      documentsProcessed: 42,
      pagesProcessed: 1800,
      aiRunCount: 12,
      failedAiRunCount: 1,
      openHighRiskCount: 4,
      openRfiCount: 6,
      submittalsNeedingReviewCount: 2,
      lastActivityAt: "2026-06-07T10:00:00.000Z",
    });

    expect(summary.healthLevel).toBe("attention");
    expect(summary.primaryConcern).toContain("4 high-risk");
    expect(summary.activityLabel).toBe("Last activity Jun 7, 2026");
  });

  test("marks accounts with failed AI runs as at risk", () => {
    const summary = buildAccountHealthSummary({
      projectCount: 1,
      memberCount: 2,
      documentsProcessed: 5,
      pagesProcessed: 120,
      aiRunCount: 8,
      failedAiRunCount: 3,
      openHighRiskCount: 0,
      openRfiCount: 0,
      submittalsNeedingReviewCount: 0,
      lastActivityAt: null,
    });

    expect(summary.healthLevel).toBe("risk");
    expect(summary.primaryConcern).toContain("3 failed AI runs");
    expect(summary.activityLabel).toBe("No activity yet");
  });

  test("marks active accounts with no concerns as healthy", () => {
    const summary = buildAccountHealthSummary({
      projectCount: 2,
      memberCount: 4,
      documentsProcessed: 12,
      pagesProcessed: 600,
      aiRunCount: 6,
      failedAiRunCount: 0,
      openHighRiskCount: 0,
      openRfiCount: 1,
      submittalsNeedingReviewCount: 0,
      lastActivityAt: "2026-06-06T10:00:00.000Z",
    });

    expect(summary.healthLevel).toBe("healthy");
    expect(summary.primaryConcern).toBe("No major account concerns");
  });

  test("maps platform summary rpc rows into account summaries", () => {
    const row = {
      organization_id: "org-1",
      organization_name: "Acme GC",
      organization_slug: "acme-gc",
      organization_created_at: "2026-06-01T00:00:00.000Z",
      organization_updated_at: "2026-06-07T00:00:00.000Z",
      account_status: "active",
      account_plan: "growth",
      account_company_type: "general_contractor",
      account_website: "https://example.com",
      account_primary_contact_name: "Pat Project",
      account_primary_contact_email: "pat@example.com",
      account_billing_contact_email: "billing@example.com",
      account_created_at: "2026-06-01T00:00:00.000Z",
      account_updated_at: "2026-06-07T00:00:00.000Z",
      project_count: "2",
      member_count: 5,
      documents_processed: "12",
      pages_processed: "600",
      ai_run_count: 8,
      failed_ai_run_count: 0,
      open_high_risk_count: 1,
      open_rfi_count: 3,
      submittals_needing_review_count: 0,
      last_activity_at: "2026-06-07T00:00:00.000Z",
      onboarding_event_types: [
        "organization_profile_completed",
        "first_project_created",
      ],
    } satisfies PlatformAccountSummaryRow;

    const summary = buildAdminAccountSummaryFromPlatformRow(row);

    expect(summary.organization.name).toBe("Acme GC");
    expect(summary.account?.plan).toBe("growth");
    expect(summary.counts.projectCount).toBe(2);
    expect(summary.counts.documentsProcessed).toBe(12);
    expect(summary.health.healthLevel).toBe("attention");
    expect(summary.onboarding.completed).toEqual([
      "organization_profile_completed",
      "first_project_created",
    ]);
  });

  test("loads admin detail with bounded recent collection queries", async () => {
    const limitedTables = new Set([
      "projects",
      "documents",
      "issues",
      "rfis",
      "submittals",
      "agent_runs",
      "organization_account_notes",
      "audit_events",
    ]);
    const tableLimits = new Map<string, number>();
    const summaryRow = {
      organization_id: "org-1",
      organization_name: "Acme GC",
      organization_slug: "acme-gc",
      organization_created_at: "2026-06-01T00:00:00.000Z",
      organization_updated_at: "2026-06-07T00:00:00.000Z",
      account_status: "active",
      account_plan: "growth",
      account_company_type: "general_contractor",
      account_website: null,
      account_primary_contact_name: null,
      account_primary_contact_email: null,
      account_billing_contact_email: null,
      account_created_at: "2026-06-01T00:00:00.000Z",
      account_updated_at: "2026-06-07T00:00:00.000Z",
      project_count: 12,
      member_count: 3,
      documents_processed: 4,
      pages_processed: 50,
      ai_run_count: 2,
      failed_ai_run_count: 0,
      open_high_risk_count: 0,
      open_rfi_count: 1,
      submittals_needing_review_count: 0,
      last_activity_at: "2026-06-07T00:00:00.000Z",
      onboarding_event_types: [],
    } satisfies PlatformAccountSummaryRow;

    const rowsByTable: Record<string, unknown[]> = {
      organizations: [
        {
          id: "org-1",
          name: "Acme GC",
          slug: "acme-gc",
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-07T00:00:00.000Z",
        },
      ],
      organization_accounts: [
        {
          organization_id: "org-1",
          status: "active",
          plan: "growth",
          company_type: "general_contractor",
          website: null,
          primary_contact_name: null,
          primary_contact_email: null,
          billing_contact_email: null,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-07T00:00:00.000Z",
        },
      ],
      organization_members: [],
      projects: [],
      documents: [],
      issues: [],
      rfis: [],
      submittals: [],
      agent_runs: [],
      organization_account_notes: [],
      audit_events: [],
      account_onboarding_events: [],
    };
    const supabase = {
      rpc: async (name: string, params: Record<string, unknown>) => {
        expect(name).toBe("get_platform_account_summaries");
        expect(params).toEqual({ p_organization_id: "org-1" });
        return { data: [summaryRow], error: null };
      },
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          maybeSingle: async () => ({
            data: rowsByTable[table]?.[0] ?? null,
            error: null,
          }),
          limit: (count: number) => {
            tableLimits.set(table, count);
            return query;
          },
          then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            resolve({ data: rowsByTable[table] ?? [], error: null }),
        };
        return query;
      },
    };

    await getAdminAccountDetail(supabase as never, "org-1");

    for (const table of limitedTables) {
      expect(tableLimits.get(table)).toBe(10);
    }
  });

  test("loads admin account lists through bounded server-side filters", async () => {
    const summaryRow = {
      organization_id: "org-1",
      organization_name: "Acme GC",
      organization_slug: "acme-gc",
      organization_created_at: "2026-06-01T00:00:00.000Z",
      organization_updated_at: "2026-06-07T00:00:00.000Z",
      account_status: "active",
      account_plan: "growth",
      account_company_type: "general_contractor",
      account_website: null,
      account_primary_contact_name: null,
      account_primary_contact_email: null,
      account_billing_contact_email: null,
      account_created_at: "2026-06-01T00:00:00.000Z",
      account_updated_at: "2026-06-07T00:00:00.000Z",
      project_count: 1,
      member_count: 2,
      documents_processed: 3,
      pages_processed: 4,
      ai_run_count: 5,
      failed_ai_run_count: 0,
      open_high_risk_count: 0,
      open_rfi_count: 0,
      submittals_needing_review_count: 0,
      last_activity_at: null,
      onboarding_event_types: [],
    } satisfies PlatformAccountSummaryRow;
    const calls: Array<{ name: string; params?: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, params?: Record<string, unknown>) => {
        calls.push({ name, params });
        if (name === "get_platform_account_summary_count") {
          return { data: 1, error: null };
        }
        return { data: [summaryRow], error: null };
      },
    };

    const result = await listAdminAccountSummaries(supabase as never, {
      search: " acme ",
      status: "active",
      page: 3,
      pageSize: 25,
    });

    expect(result.accounts).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1,
    });
    expect(calls).toEqual([
      {
        name: "get_platform_account_summary_count",
        params: {
          p_organization_id: null,
          p_search: "acme",
          p_status: "active",
        },
      },
      {
        name: "get_platform_account_summaries",
        params: {
          p_organization_id: null,
          p_search: "acme",
          p_status: "active",
          p_limit: 25,
          p_offset: 50,
        },
      },
    ]);
  });

  test("preserves account list totals when the requested page has no rows", async () => {
    const calls: Array<{ name: string; params?: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, params?: Record<string, unknown>) => {
        calls.push({ name, params });
        if (name === "get_platform_account_summary_count") {
          return { data: 26, error: null };
        }
        return { data: [], error: null };
      },
    };

    const result = await listAdminAccountSummaries(supabase as never, {
      page: 3,
      pageSize: 25,
    });

    expect(result.accounts).toEqual([]);
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 25,
      totalCount: 26,
      totalPages: 2,
    });
    expect(calls.map((call) => call.name)).toEqual([
      "get_platform_account_summary_count",
      "get_platform_account_summaries",
    ]);
  });
});
