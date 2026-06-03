import type { Submittal, SubmittalReviewResult } from "@/lib/types/database";

const reviewStatusColors: Record<Submittal["review_status"], string> = {
  pending: "bg-zinc-100 text-zinc-700",
  pass: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  fail: "bg-red-100 text-red-800",
};

const overallStatusLabels: Record<string, string> = {
  approved: "Approved",
  approved_as_noted: "Approved as Noted",
  revise_and_resubmit: "Revise & Resubmit",
  rejected: "Rejected",
};

const itemStatusColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  fail: "bg-red-100 text-red-800",
  unknown: "bg-zinc-100 text-zinc-700",
};

function getReviewResult(submittal: Submittal): SubmittalReviewResult | null {
  const result = submittal.review_result;
  if (!result || typeof result !== "object" || !("overall_status" in result)) {
    return null;
  }
  return result as SubmittalReviewResult;
}

export function ReviewResults({ submittal }: { submittal: Submittal }) {
  const review = getReviewResult(submittal);
  const items = review?.items ?? submittal.review_findings ?? [];

  if (!review && !submittal.review_summary) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        {review && (
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
            {overallStatusLabels[review.overall_status] ?? review.overall_status}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${reviewStatusColors[submittal.review_status]}`}
        >
          db status: {submittal.review_status}
        </span>
      </div>

      {submittal.review_summary && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{submittal.review_summary}</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-zinc-500">
                  Requirement
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-zinc-500">
                  Submitted
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-zinc-500">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-zinc-500">
                  Severity
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-zinc-500">
                  Recommendation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {items.map((item, index) => (
                <tr key={`${submittal.id}-item-${index}`}>
                  <td className="px-3 py-3 align-top text-sm text-zinc-800 dark:text-zinc-200">
                    {item.requirement}
                    {item.evidence?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.evidence.map((ev, evIndex) => (
                          <div
                            key={`${index}-ev-${evIndex}`}
                            className="rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            <span className="font-medium capitalize text-orange-700">
                              {ev.source}
                            </span>
                            {" · "}
                            {ev.document_name} p.{ev.page_number}
                            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{ev.quote}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top text-sm text-zinc-700 dark:text-zinc-300">
                    {item.submitted_value}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${itemStatusColors[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-sm capitalize text-zinc-600">
                    {item.severity}
                  </td>
                  <td className="px-3 py-3 align-top text-sm text-zinc-700 dark:text-zinc-300">
                    {item.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
