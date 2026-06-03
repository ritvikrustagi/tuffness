"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Submittal } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReviewResults } from "@/components/submittals/review-results";

const docStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function SubmittalList({
  projectId,
  submittals,
}: {
  projectId: string;
  submittals: Submittal[];
}) {
  const router = useRouter();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function pollRun(submittalId: string, runId: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch(`/api/projects/${projectId}/agent-runs/${runId}`);
      const data = await res.json();
      const run = data.agent_run;
      if (!run) continue;

      if (run.status === "running") {
        setStatus("Reviewing submittal against specifications...");
        continue;
      }

      if (run.status === "completed") {
        setStatus("Review complete. Results below require human approval.");
        router.refresh();
        setReviewingId(null);
        return;
      }

      if (run.status === "failed") {
        throw new Error(run.error_message ?? "Submittal review failed");
      }
    }

    throw new Error("Review timed out while waiting for completion");
  }

  async function reviewSubmittal(submittalId: string, documentStatus?: string) {
    if (documentStatus !== "ready") {
      setError("Submittal must finish processing before review.");
      return;
    }

    setReviewingId(submittalId);
    setError(null);
    setStatus("Starting review...");

    try {
      const res = await fetch(
        `/api/projects/${projectId}/submittals/${submittalId}/review`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start review");
      await pollRun(submittalId, data.agent_run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
      setReviewingId(null);
      setStatus(null);
    }
  }

  if (submittals.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No submittals uploaded yet. Upload a submittal PDF above to begin review.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && reviewingId && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      )}

      {submittals.map((submittal) => {
        const doc = submittal.documents;
        const isReviewing = reviewingId === submittal.id;

        return (
          <Card key={submittal.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {submittal.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {submittal.category && `${submittal.category} · `}
                  {doc?.file_name ?? "No file"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {doc?.status && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${docStatusColors[doc.status]}`}
                  >
                    doc: {doc.status}
                  </span>
                )}
                <Button
                  onClick={() => reviewSubmittal(submittal.id, doc?.status)}
                  disabled={isReviewing || doc?.status !== "ready"}
                >
                  {isReviewing ? "Reviewing..." : "Review Against Specs"}
                </Button>
              </div>
            </div>

            <ReviewResults submittal={submittal} />
          </Card>
        );
      })}
    </div>
  );
}
