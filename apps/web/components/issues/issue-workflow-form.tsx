import type { Issue } from "@/lib/types/database";
import {
  getAllowedIssueTransitions,
  issueStatuses,
  rfiStatuses,
  type IssueWorkflowDraft,
} from "@/lib/issues/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatStatus } from "@/components/issues/issue-display";

function issueStatusOptions(issue: Issue) {
  return issueStatuses.filter(
    (status) => status === issue.status || getAllowedIssueTransitions(issue.status).includes(status)
  );
}

export function IssueWorkflowForm({
  issue,
  draft,
  saving,
  onChange,
  onSave,
  onCopy,
}: {
  issue: Issue;
  draft: IssueWorkflowDraft;
  saving: boolean;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
  onSave: () => void;
  onCopy: () => void;
}) {
  return (
    <>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Issue status
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={draft.status}
            onChange={(event) =>
              onChange({ status: event.target.value as IssueWorkflowDraft["status"] })
            }
          >
            {issueStatusOptions(issue).map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          RFI status
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={draft.rfi_status}
            onChange={(event) =>
              onChange({ rfi_status: event.target.value as IssueWorkflowDraft["rfi_status"] })
            }
          >
            {rfiStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Trade
          <Input
            className="mt-1"
            value={draft.trade}
            onChange={(event) => onChange({ trade: event.target.value })}
            placeholder="doors/hardware"
          />
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Discipline
          <Input
            className="mt-1"
            value={draft.discipline}
            onChange={(event) => onChange({ discipline: event.target.value })}
            placeholder="architectural"
          />
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Due date
          <Input
            className="mt-1"
            type="date"
            value={draft.due_date}
            onChange={(event) => onChange({ due_date: event.target.value })}
          />
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          External RFI #
          <Input
            className="mt-1"
            value={draft.external_rfi_number}
            onChange={(event) => onChange({ external_rfi_number: event.target.value })}
            placeholder="RFI-042"
          />
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 md:col-span-2">
          External URL
          <Input
            className="mt-1"
            value={draft.external_url}
            onChange={(event) => onChange({ external_url: event.target.value })}
            placeholder="https://"
          />
        </label>

        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 lg:col-span-4">
          External issue URL
          <Input
            className="mt-1"
            value={draft.external_system_url}
            onChange={(event) => onChange({ external_system_url: event.target.value })}
            placeholder="https://"
          />
        </label>
      </div>

      <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Draft RFI
        <textarea
          className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          value={draft.draft_rfi}
          onChange={(event) => onChange({ draft_rfi: event.target.value })}
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Response
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          value={draft.response}
          onChange={(event) => onChange({ response: event.target.value })}
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Resolution notes
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          value={draft.resolution_notes}
          onChange={(event) => onChange({ resolution_notes: event.target.value })}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Workflow"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCopy} disabled={!draft.draft_rfi}>
          Copy Draft RFI
        </Button>
      </div>
    </>
  );
}
