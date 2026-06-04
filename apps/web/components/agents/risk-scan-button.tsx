"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ScanMode = "risk" | "compliance";

const scanConfig: Record<
  ScanMode,
  {
    endpoint: string;
    idleLabel: string;
    loadingLabel: string;
    startingLabel: string;
    runningLabel: string;
    completeLabel: (risksCreated: number, rfisCreated: number) => string;
    errorLabel: string;
    Icon: typeof AlertTriangle;
  }
> = {
  risk: {
    endpoint: "risk-scan",
    idleLabel: "Scan Risks",
    loadingLabel: "Scanning...",
    startingLabel: "Starting risk scan...",
    runningLabel: "Scanning project documents for risks...",
    completeLabel: (risksCreated, rfisCreated) =>
      risksCreated
        ? `Risk scan complete. ${risksCreated} risk(s) found, ${rfisCreated} draft RFI(s) created.`
        : "Risk scan complete. No new risks detected.",
    errorLabel: "Risk scan failed",
    Icon: AlertTriangle,
  },
  compliance: {
    endpoint: "compliance-scan",
    idleLabel: "Scan Compliance",
    loadingLabel: "Scanning...",
    startingLabel: "Starting compliance scan...",
    runningLabel: "Scanning project documents for compliance items...",
    completeLabel: (risksCreated, rfisCreated) =>
      risksCreated
        ? `Compliance scan complete. ${risksCreated} item(s) found, ${rfisCreated} draft RFI(s) created.`
        : "Compliance scan complete. No new compliance items detected.",
    errorLabel: "Compliance scan failed",
    Icon: ShieldCheck,
  },
};

export function RiskScanButton({
  projectId,
  mode = "risk",
}: {
  projectId: string;
  mode?: ScanMode;
}) {
  const router = useRouter();
  const config = scanConfig[mode];
  const Icon = config.Icon;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pollRun(runId: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch(`/api/projects/${projectId}/agent-runs/${runId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to check risk scan status");
      }

      const run = data.agent_run;

      if (!run) continue;

      if (run.status === "running") {
        setStatus(config.runningLabel);
        continue;
      }

      if (run.status === "completed") {
        const summary = run.output_summary as { risks_created?: number; rfis_created?: number };
        const risksCreated = summary.risks_created ?? 0;
        const rfisCreated = summary.rfis_created ?? 0;
        setStatus(config.completeLabel(risksCreated, rfisCreated));
        router.refresh();
        setLoading(false);
        return;
      }

      if (run.status === "failed") {
        throw new Error(run.error_message ?? "Risk scan failed");
      }
    }

    throw new Error(`${config.errorLabel} while waiting for completion`);
  }

  async function startScan() {
    setLoading(true);
    setError(null);
    setStatus(config.startingLabel);

    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${config.endpoint}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start risk scan");
      }

      await pollRun(data.agent_run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : config.errorLabel);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={startScan} disabled={loading} className="gap-2">
        <Icon className="h-4 w-4" />
        {loading ? config.loadingLabel : config.idleLabel}
      </Button>
      {status && !error && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
        >
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
