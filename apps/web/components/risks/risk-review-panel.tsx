import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Issue } from "@/lib/types/database";

export function RiskReviewPanel({
  issue,
  saving,
  onMarkReviewed,
}: {
  issue: Issue;
  saving: boolean;
  onMarkReviewed: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Review status
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {issue.human_reviewed_at
              ? `Reviewed ${new Date(issue.human_reviewed_at).toLocaleString()}`
              : "Awaiting human review"}
          </p>
        </div>
        <Button type="button" onClick={onMarkReviewed} disabled={saving}>
          {saving ? "Saving..." : "Mark reviewed"}
        </Button>
      </div>
    </Card>
  );
}
