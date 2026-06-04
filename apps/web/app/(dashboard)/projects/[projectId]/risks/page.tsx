import { RiskScanButton } from "@/components/agents/risk-scan-button";
import { RiskRegister } from "@/components/risks/risk-register";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types/database";

export default async function ProjectRisksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: risks } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .not("risk_tier", "is", null)
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const typedRisks = (risks ?? []) as Issue[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            AI Risk Register
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Review scored project risks, evidence, and recommended next actions before assigning
            follow-up work.
          </p>
        </div>
        <RiskScanButton projectId={projectId} />
      </div>

      <RiskRegister projectId={projectId} risks={typedRisks} />
    </div>
  );
}
