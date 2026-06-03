"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RfiScanButton({ projectId }: { projectId: string }) {
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
        setStatus("Scanning documents for potential RFIs...");
        continue;
      }

      if (run.status === "completed") {
        const summary = run.output_summary as { issues_created?: number };
        setStatus(
          summary.issues_created
            ? `Found ${summary.issues_created} potential issue(s). Review below.`
            : "Scan complete. No issues detected."
        );
        router.refresh();
        setLoading(false);
        return;
      }

      if (run.status === "failed") {
        throw new Error(run.error_message ?? "RFI scan failed");
      }
    }

    throw new Error("RFI scan timed out while waiting for completion");
  }

  async function startScan() {
    setLoading(true);
    setError(null);
    setStatus("Starting RFI scan...");

    try {
      const res = await fetch(`/api/projects/${projectId}/agents/rfi-scan`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start RFI scan");
      }

      await pollRun(data.agent_run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RFI scan failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={startScan} disabled={loading}>
        {loading ? "Scanning..." : "Find Potential RFIs"}
      </Button>
      {status && !error && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
