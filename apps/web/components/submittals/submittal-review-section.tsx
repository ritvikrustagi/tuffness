"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SubmittalUpload } from "@/components/submittals/submittal-upload";
import { SubmittalList } from "@/components/submittals/submittal-list";
import type { Submittal } from "@/lib/types/database";

export function SubmittalReviewSection({
  projectId,
  initialSubmittals,
}: {
  projectId: string;
  initialSubmittals: Submittal[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Upload Submittal</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Upload a submittal PDF for ingestion, then run a controlled spec comparison. All results
          require human approval before action.
        </p>
        <SubmittalUpload
          projectId={projectId}
          onUploaded={() => router.refresh()}
        />
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Submittal Review</h2>
        <SubmittalList projectId={projectId} submittals={initialSubmittals} />
      </div>
    </div>
  );
}
