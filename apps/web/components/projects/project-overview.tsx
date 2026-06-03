import Link from "next/link";
import type React from "react";
import { RfiScanButton } from "@/components/agents/rfi-scan-button";
import { Card } from "@/components/ui/card";
import type { ProjectDashboardData } from "@/lib/projects/dashboard";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </Card>
  );
}

function ActivityItem({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block border-b border-zinc-100 py-3 text-sm transition last:border-0 hover:text-orange-700 dark:border-zinc-800 dark:hover:text-orange-400"
    >
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </Link>
  );
}

function ActivityList<TItem>({
  title,
  emptyText,
  items,
  renderItem,
}: {
  title: string;
  emptyText: string;
  items: TItem[];
  renderItem: (item: TItem) => React.ReactNode;
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map(renderItem)
        ) : (
          <p className="text-sm text-zinc-500">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}

export function ProjectOverview({ dashboard }: { dashboard: ProjectDashboardData }) {
  const {
    projectId,
    agentRuns,
    documentSummary,
    issueSummary,
    submittalSummary,
    recentDocuments,
    recentIssues,
    recentSubmittals,
  } = dashboard;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Project overview
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Track document readiness, RFI work, and submittal review from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${projectId}/documents`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Upload documents
          </Link>
          <Link
            href={`/projects/${projectId}/chat`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Ask a question
          </Link>
          <Link
            href={`/projects/${projectId}/submittals`}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Review submittals
          </Link>
          <RfiScanButton projectId={projectId} />
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Document readiness
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Documents" value={documentSummary.total} />
          <StatCard label="Ready" value={documentSummary.ready} />
          <StatCard label="Processing" value={documentSummary.in_progress} />
          <StatCard label="Failed" value={documentSummary.failed} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          RFI workflow
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Open issues" value={issueSummary.open_issues} />
          <StatCard label="Draft RFIs" value={issueSummary.draft_rfis} />
          <StatCard label="Submitted" value={issueSummary.submitted_rfis} />
          <StatCard label="Answered" value={issueSummary.answered_awaiting_closeout} />
          <StatCard label="Closed" value={issueSummary.closed} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Submittal review
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Submittals" value={submittalSummary.total} />
          <StatCard label="Pending" value={submittalSummary.pending} />
          <StatCard label="Pass" value={submittalSummary.pass} />
          <StatCard label="Warning" value={submittalSummary.warning} />
          <StatCard label="Fail" value={submittalSummary.fail} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActivityList
          title="Recent documents"
          emptyText="No documents uploaded yet."
          items={recentDocuments}
          renderItem={(document) => (
            <ActivityItem
              key={document.id}
              href={`/projects/${projectId}/documents`}
              title={document.name}
              detail={`${document.document_type} · ${document.status}`}
            />
          )}
        />

        <ActivityList
          title="Recent RFIs"
          emptyText="No RFI issues yet."
          items={recentIssues}
          renderItem={(issue) => (
            <ActivityItem
              key={issue.id}
              href={`/projects/${projectId}/issues`}
              title={issue.summary}
              detail={`${issue.severity} · ${issue.status}`}
            />
          )}
        />

        <ActivityList
          title="Recent submittals"
          emptyText="No submittals uploaded yet."
          items={recentSubmittals}
          renderItem={(submittal) => (
            <ActivityItem
              key={submittal.id}
              href={`/projects/${projectId}/submittals`}
              title={submittal.title}
              detail={`${submittal.review_status}${submittal.spec_section ? ` · ${submittal.spec_section}` : ""}`}
            />
          )}
        />
      </section>

      {agentRuns.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recent agent runs
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {agentRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {run.agent_type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {run.status} · {new Date(run.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
