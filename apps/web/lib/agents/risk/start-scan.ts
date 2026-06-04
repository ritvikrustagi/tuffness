import { after, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { failRiskAgentRun, RiskScanError, runRiskScan } from "@/lib/agents/risk/runner";
import type { RiskScanMode } from "@/lib/agents/risk/profile";
import { createAdminClient } from "@/lib/supabase/admin";

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

export async function startProjectRiskScan({
  projectId,
  mode,
  label,
}: {
  projectId: string;
  mode: RiskScanMode;
  label: string;
}) {
  const { user, project, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const adminSupabase = createAdminClient();

  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("agent_type", "risk_agent")
    .eq("status", "running")
    .maybeSingle();

  if (running) {
    return NextResponse.json(
      { error: `A ${label} scan is already running for this project.`, agent_run_id: running.id },
      { status: 409 }
    );
  }

  const { data: agentRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      project_id: projectId,
      organization_id: project!.organization_id,
      agent_type: "risk_agent",
      status: "running",
      input_params: { mode },
      triggered_by: user!.id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (isUniqueViolation(runError)) {
    return NextResponse.json(
      { error: `A ${label} scan is already running for this project.` },
      { status: 409 }
    );
  }

  if (runError || !agentRun) {
    return NextResponse.json(
      { error: runError?.message ?? `Failed to create ${label} agent run` },
      { status: 500 }
    );
  }

  after(async () => {
    try {
      await runRiskScan({
        supabase: adminSupabase,
        projectId,
        organizationId: project!.organization_id,
        agentRunId: agentRun.id,
        userId: user!.id,
        mode,
      });
    } catch (err) {
      const scanError =
        err instanceof RiskScanError
          ? err
          : new RiskScanError(
              err instanceof Error ? err.message : `${label} scan failed`,
              "db_error"
            );
      await failRiskAgentRun(adminSupabase, agentRun.id, scanError);
    }
  });

  return NextResponse.json(
    {
      agent_run_id: agentRun.id,
      status: "running",
    },
    { status: 202 }
  );
}
