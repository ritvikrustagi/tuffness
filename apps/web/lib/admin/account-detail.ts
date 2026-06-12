import type {
  AccountOnboardingEvent,
  AgentRun,
  AuditEvent,
  Document,
  Issue,
  OrganizationAccountNote,
  OrganizationMember,
  Project,
  Rfi,
  Submittal,
} from "@/lib/types/database";
import type { createClient } from "@/lib/supabase/server";
import {
  buildAdminAccountSummaryFromPlatformRow,
  type AdminAccountSummary,
  type PlatformAccountSummaryRow,
} from "./account-summaries";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AdminAccountDetail = AdminAccountSummary & {
  members: OrganizationMember[];
  recentProjects: Project[];
  recentDocuments: Document[];
  recentIssues: Issue[];
  recentRfis: Rfi[];
  recentSubmittals: Submittal[];
  recentAgentRuns: AgentRun[];
  notes: OrganizationAccountNote[];
  auditEvents: AuditEvent[];
  onboardingEvents: AccountOnboardingEvent[];
};

export async function getAdminAccountDetail(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AdminAccountDetail | null> {
  const summaryResult = await supabase.rpc("get_platform_account_summaries", {
    p_organization_id: organizationId,
  });
  if (summaryResult.error) throw new Error(summaryResult.error.message);

  const summaryRow = ((summaryResult.data ?? []) as PlatformAccountSummaryRow[])[0];
  if (!summaryRow) return null;

  const summary = buildAdminAccountSummaryFromPlatformRow(summaryRow);
  const [
    membersResult,
    projectsResult,
    documentsResult,
    issuesResult,
    rfisResult,
    submittalsResult,
    agentRunsResult,
    notesResult,
    auditResult,
    onboardingResult,
  ] = await Promise.all([
    supabase.from("organization_members").select("*").eq("organization_id", organizationId),
    supabase
      .from("projects")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("issues")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("rfis")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("submittals")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("organization_account_notes")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_events")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("account_onboarding_events")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  for (const result of [
    membersResult,
    projectsResult,
    documentsResult,
    issuesResult,
    rfisResult,
    submittalsResult,
    agentRunsResult,
    notesResult,
    auditResult,
    onboardingResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const members = (membersResult.data ?? []) as OrganizationMember[];
  const projects = (projectsResult.data ?? []) as Project[];
  const documents = (documentsResult.data ?? []) as Document[];
  const issues = (issuesResult.data ?? []) as Issue[];
  const rfis = (rfisResult.data ?? []) as Rfi[];
  const submittals = (submittalsResult.data ?? []) as Submittal[];
  const agentRuns = (agentRunsResult.data ?? []) as AgentRun[];
  const onboardingEvents = (onboardingResult.data ?? []) as AccountOnboardingEvent[];

  return {
    ...summary,
    members,
    recentProjects: projects,
    recentDocuments: documents,
    recentIssues: issues,
    recentRfis: rfis,
    recentSubmittals: submittals,
    recentAgentRuns: agentRuns,
    notes: (notesResult.data ?? []) as OrganizationAccountNote[],
    auditEvents: (auditResult.data ?? []) as AuditEvent[],
    onboardingEvents,
  };
}
