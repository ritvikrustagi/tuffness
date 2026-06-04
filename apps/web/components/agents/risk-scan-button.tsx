"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RiskScanButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pollRun(runId: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch(`/api/projects/${projectId}/agent-runs/${runId}`);
      const data = await res.json();
      const run = data.agent_run;

      if (!run) continue;

      if (run.status === "running") {
        setStatus("Scanning project documents for risks...");
        continue;
      }

      if (run.status === "completed") {
        const summary = run.output_summary as { risks_created?: number; rfis_created?: number };
        const risksCreated = summary.risks_created ?? 0;
        const rfisCreated = summary.rfis_created ?? 0;
        setStatus(
          risksCreated
            ? `Risk scan complete. ${risksCreated} risk(s) found, ${rfisCreated} draft RFI(s) created.`
            : "Risk scan complete. No new risks detected."
        );
        router.refresh();
        setLoading(false);
        return;
      }

      if (run.status === "failed") {
        throw new Error(run.error_message ?? "Risk scan failed");
      }
    }

    throw new Error("Risk scan timed out while waiting for completion");
  }

  async function startScan() {
    setLoading(true);
    setError(null);
    setStatus("Starting risk scan...");

    try {
      const res = await fetch(`/api/projects/${projectId}/agents/risk-scan`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start risk scan");
      }

      await pollRun(data.agent_run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk scan failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={startScan} disabled={loading} className="gap-2">
        <AlertTriangle className="h-4 w-4" />
        {loading ? "Scanning..." : "Scan Risks"}
      </Button>
      {status && !error && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
