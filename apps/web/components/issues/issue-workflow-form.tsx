import {
  getAllowedWorkflowTransitions,
  type IssueWorkflowDraft,
  type IssueWorkflowState,
} from "@/lib/issues/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatStatus } from "@/components/issues/issue-display";

function workflowStateOptions(state: IssueWorkflowState) {
  return [state, ...getAllowedWorkflowTransitions(state)];
}

function WorkflowSection({ title }: { title: string }) {
  return (
    <div className="mt-5 border-t border-zinc-200 pt-4 first:mt-4 dark:border-zinc-800">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>
      {label}
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  minHeightClass,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeightClass: string;
}) {
  return (
    <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <textarea
        className={`mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 ${minHeightClass}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function WorkflowFields({
  draft,
  onChange,
}: {
  draft: IssueWorkflowDraft;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
}) {
  return (
    <>
      <WorkflowSection title="Workflow" />
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 md:col-span-2">
          Workflow state
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={draft.workflow_state}
            onChange={(event) =>
              onChange({ workflow_state: event.target.value as IssueWorkflowState })
            }
          >
            {workflowStateOptions(draft.workflow_state).map((state) => (
              <option key={state} value={state}>
                {formatStatus(state)}
              </option>
            ))}
          </select>
        </label>

        <TextField
          label="Trade"
          value={draft.trade}
          onChange={(trade) => onChange({ trade })}
          placeholder="doors/hardware"
        />
        <TextField
          label="Discipline"
          value={draft.discipline}
          onChange={(discipline) => onChange({ discipline })}
          placeholder="architectural"
        />
        <TextField
          label="Due date"
          type="date"
          value={draft.due_date}
          onChange={(due_date) => onChange({ due_date })}
        />
        <TextField
          label="External RFI #"
          value={draft.external_rfi_number}
          onChange={(external_rfi_number) => onChange({ external_rfi_number })}
          placeholder="RFI-042"
        />
      </div>
    </>
  );
}

function DraftFields({
  draft,
  onChange,
}: {
  draft: IssueWorkflowDraft;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
}) {
  return (
    <>
      <WorkflowSection title="RFI draft" />
      <TextField
        label="Subject"
        className="mt-3 block"
        value={draft.subject}
        onChange={(subject) => onChange({ subject })}
        placeholder="Door hardware conflict"
      />
      <TextAreaField
        label="Question"
        minHeightClass="min-h-32"
        value={draft.draft_rfi}
        onChange={(draft_rfi) => onChange({ draft_rfi })}
      />
      <TextAreaField
        label="Background / context"
        minHeightClass="min-h-24"
        value={draft.description}
        onChange={(description) => onChange({ description })}
      />
    </>
  );
}

function ExternalTrackingFields({
  draft,
  onChange,
}: {
  draft: IssueWorkflowDraft;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
}) {
  return (
    <>
      <WorkflowSection title="External tracking" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextField
          label="External RFI URL"
          value={draft.external_url}
          onChange={(external_url) => onChange({ external_url })}
          placeholder="https://"
        />
        <TextField
          label="External issue URL"
          value={draft.external_system_url}
          onChange={(external_system_url) => onChange({ external_system_url })}
          placeholder="https://"
        />
      </div>
    </>
  );
}

function CloseoutFields({
  draft,
  onChange,
}: {
  draft: IssueWorkflowDraft;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
}) {
  return (
    <>
      <WorkflowSection title="Closeout" />
      <TextAreaField
        label="Response"
        minHeightClass="min-h-20"
        value={draft.response}
        onChange={(response) => onChange({ response })}
      />
      <TextAreaField
        label="Resolution notes"
        minHeightClass="min-h-20"
        value={draft.resolution_notes}
        onChange={(resolution_notes) => onChange({ resolution_notes })}
      />
    </>
  );
}

export function IssueWorkflowForm({
  draft,
  saving,
  onChange,
  onSave,
  onCopy,
  onExport,
}: {
  draft: IssueWorkflowDraft;
  saving: boolean;
  onChange: (patch: Partial<IssueWorkflowDraft>) => void;
  onSave: () => void;
  onCopy: () => void;
  onExport: () => void;
}) {
  return (
    <>
      <WorkflowFields draft={draft} onChange={onChange} />
      <DraftFields draft={draft} onChange={onChange} />
      <ExternalTrackingFields draft={draft} onChange={onChange} />
      <CloseoutFields draft={draft} onChange={onChange} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Workflow"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCopy} disabled={!draft.draft_rfi}>
          Copy Draft RFI
        </Button>
        <Button type="button" variant="secondary" onClick={onExport} disabled={!draft.draft_rfi}>
          Export Text
        </Button>
      </div>
    </>
  );
}
