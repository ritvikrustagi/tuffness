import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildDraftRfiDownloadName,
  buildDraftRfiExportText,
  buildIssueWorkflowPatch,
  deriveWorkflowState,
  getAllowedWorkflowTransitions,
  getWorkflowStatuses,
  getInitialIssueWorkflowDraft,
  isWorkflowTransitionAllowed,
  normalizeIssueEvidence,
  summarizeIssueWorkflows,
  issueWorkflowModel,
} from "./workflow";

function parseSqlTupleList(sql: string, insertTarget: string) {
  const insertStart = sql.indexOf(`INSERT INTO public.${insertTarget}`);
  expect(insertStart).toBeGreaterThan(-1);

  const valuesStart = sql.indexOf("VALUES", insertStart);
  const valuesEnd = sql.indexOf("ON CONFLICT", valuesStart);
  expect(valuesStart).toBeGreaterThan(-1);
  expect(valuesEnd).toBeGreaterThan(valuesStart);

  return [...sql.slice(valuesStart, valuesEnd).matchAll(/\(([^)]+)\)/g)].map((match) =>
    [...match[1].matchAll(/'([^']*)'|(TRUE|FALSE)/g)].map((valueMatch) => {
      if (valueMatch[2]) return valueMatch[2] === "TRUE";
      return valueMatch[1];
    })
  );
}

describe("RFI issue workflow", () => {
  test("allows draft RFI lifecycle states from an open issue", () => {
    expect(getAllowedWorkflowTransitions("open")).toEqual([
      "acknowledged",
      "draft_rfi",
      "resolved",
      "dismissed",
    ]);
  });

  test("rejects workflow jumps that skip the state machine", () => {
    expect(isWorkflowTransitionAllowed("open", "answered")).toBe(false);
    expect(isWorkflowTransitionAllowed("open", "draft_rfi")).toBe(true);
    expect(isWorkflowTransitionAllowed("resolved", "open")).toBe(true);
  });

  test("derives issue and RFI statuses from the canonical workflow model", () => {
    expect(getWorkflowStatuses("approved")).toEqual({
      status: "draft_rfi",
      rfi_status: "approved",
    });
    expect(getWorkflowStatuses("submitted")).toEqual({
      status: "submitted",
      rfi_status: "submitted_externally",
    });
  });

  test("derives editable workflow draft from the issue and linked RFI", () => {
    expect(
      getInitialIssueWorkflowDraft({
        issue: {
          summary: "Door hardware conflict",
          status: "draft_rfi",
          trade: "doors",
          due_date: "2026-06-12",
          discipline: null,
          resolution_notes: null,
          description: "Issue background",
          external_system_url: null,
          draft_rfi: "Issue draft",
        },
        rfi: {
          status: "needs_edit",
          subject: "Door hardware question",
          external_rfi_number: "RFI-007",
          external_url: "https://example.com/rfis/7",
          question: "Linked RFI question",
          response: null,
        },
      })
    ).toEqual({
      workflow_state: "needs_edit",
      status: "draft_rfi",
      rfi_status: "needs_edit",
      subject: "Door hardware question",
      trade: "doors",
      discipline: "",
      due_date: "2026-06-12",
      external_system_url: "",
      external_rfi_number: "RFI-007",
      external_url: "https://example.com/rfis/7",
      response: "",
      resolution_notes: "",
      description: "Issue background",
      draft_rfi: "Linked RFI question",
    });
  });

  test("derives one workflow state from issue and RFI statuses", () => {
    expect(deriveWorkflowState({ issueStatus: "open", rfiStatus: null })).toBe("open");
    expect(deriveWorkflowState({ issueStatus: "draft_rfi", rfiStatus: "approved" })).toBe(
      "approved"
    );
    expect(
      deriveWorkflowState({ issueStatus: "submitted", rfiStatus: "submitted_externally" })
    ).toBe("submitted");
    expect(deriveWorkflowState({ issueStatus: "resolved", rfiStatus: "closed" })).toBe(
      "resolved"
    );
  });

  test("trims workflow payload fields and preserves clearable nulls", () => {
    expect(
      buildIssueWorkflowPatch({
        workflow_state: "approved",
        status: "draft_rfi",
        rfi_status: "needs_edit",
        subject: " Door hardware ",
        trade: " doors ",
        discipline: "",
        due_date: "2026-06-15",
        external_system_url: " ",
        external_rfi_number: " RFI-042 ",
        external_url: " https://example.com/rfis/42 ",
        response: "",
        resolution_notes: " needs owner response ",
        description: " Conflicting requirements between A601 and spec. ",
        draft_rfi: " Confirm door hardware set. ",
      })
    ).toEqual({
      workflow_state: "approved",
      status: "draft_rfi",
      rfi_status: "approved",
      subject: "Door hardware",
      trade: "doors",
      discipline: null,
      due_date: "2026-06-15",
      external_system_url: null,
      external_rfi_number: "RFI-042",
      external_url: "https://example.com/rfis/42",
      response: null,
      resolution_notes: "needs owner response",
      description: "Conflicting requirements between A601 and spec.",
      draft_rfi: "Confirm door hardware set.",
    });
  });

  test("normalizes agent evidence into quote-backed issue evidence", () => {
    expect(
      normalizeIssueEvidence([
        {
          document_id: "11111111-1111-4111-8111-111111111111",
          document_name: "A601 Door Schedule",
          page_number: 12,
          quote: "Door 101 hardware set is omitted.",
        },
      ])
    ).toEqual([
      {
        document_id: "11111111-1111-4111-8111-111111111111",
        document_name: "A601 Door Schedule",
        page_number: 12,
        excerpt: "Door 101 hardware set is omitted.",
        quote: "Door 101 hardware set is omitted.",
      },
    ]);
  });

  test("summarizes dashboard counts from canonical workflow state", () => {
    expect(
      summarizeIssueWorkflows([
        { status: "open", rfis: [] },
        { status: "acknowledged", rfis: [] },
        { status: "draft_rfi", rfis: [{ status: "draft" }] },
        { status: "draft_rfi", rfis: [{ status: "needs_edit" }] },
        { status: "draft_rfi", rfis: [{ status: "approved" }] },
        { status: "submitted", rfis: [{ status: "submitted_externally" }] },
        { status: "answered", rfis: [{ status: "answered" }] },
        { status: "resolved", rfis: [{ status: "closed" }] },
        { status: "dismissed", rfis: [{ status: "closed" }] },
      ])
    ).toEqual({
      total: 9,
      open_issues: 2,
      draft_rfis: 3,
      submitted_rfis: 1,
      answered_awaiting_closeout: 1,
      closed: 2,
    });
  });

  test("builds a paste-ready draft RFI export with evidence and external fields", () => {
    const text = buildDraftRfiExportText({
      issue: {
        summary: "Door hardware conflict",
        description: "A601 omits hardware set while spec requires one.",
        severity: "high",
        trade: "doors",
        discipline: "architectural",
        due_date: "2026-06-15",
        evidence: [
          {
            document_id: "doc-1",
            document_name: "A601 Door Schedule",
            page_number: 12,
            quote: "Door 101 hardware set is omitted.",
          },
        ],
      },
      draft: {
        workflow_state: "approved",
        status: "draft_rfi",
        rfi_status: "approved",
        subject: "Door hardware conflict",
        trade: "doors",
        discipline: "architectural",
        due_date: "2026-06-15",
        external_system_url: "https://example.com/issues/door",
        external_rfi_number: "RFI-042",
        external_url: "https://example.com/rfis/42",
        response: "",
        resolution_notes: "",
        description: "A601 omits hardware set while spec requires one.",
        draft_rfi: "Please confirm the required hardware set for Door 101.",
      },
    });

    expect(text).toContain("Subject: Door hardware conflict");
    expect(text).toContain("Question:\nPlease confirm the required hardware set for Door 101.");
    expect(text).toContain("Evidence:\n1. A601 Door Schedule, page 12: Door 101 hardware set is omitted.");
    expect(text).toContain("External RFI Number: RFI-042");
    expect(text).not.toContain("undefined");
  });

  test("builds stable draft RFI download filenames", () => {
    expect(buildDraftRfiDownloadName(" Door / Hardware Conflict ")).toBe(
      "door-hardware-conflict.txt"
    );
    expect(buildDraftRfiDownloadName("!!!")).toBe("draft-rfi.txt");
  });

  test("matches the workflow states and transitions enforced by the SQL migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../supabase/migrations/006_rfi_workflow.sql"),
      "utf8"
    );

    const sqlStates = Object.fromEntries(
      parseSqlTupleList(migration, "issue_workflow_states").map(
        ([workflow_state, issue_status, rfi_status, summary_bucket, creates_rfi]) => [
          workflow_state,
          { issue_status, rfi_status, summary_bucket, creates_rfi },
        ]
      )
    );
    const tsStates = Object.fromEntries(
      Object.entries(issueWorkflowModel).map(([workflow_state, definition]) => [
        workflow_state,
        {
          issue_status: definition.issue_status,
          rfi_status: definition.rfi_status,
          summary_bucket: definition.summary_bucket,
          creates_rfi: definition.creates_rfi,
        },
      ])
    );

    const sqlTransitions = parseSqlTupleList(migration, "issue_workflow_transitions").map(
      ([current_state, next_state]) => `${current_state}->${next_state}`
    );
    const tsTransitions = Object.entries(issueWorkflowModel).flatMap(
      ([current_state, definition]) =>
        definition.transitions.map((next_state) => `${current_state}->${next_state}`)
    );

    expect(sqlStates).toEqual(tsStates);
    expect(sqlTransitions).toEqual(tsTransitions);
  });
});
