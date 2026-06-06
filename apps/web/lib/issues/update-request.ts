import { z } from "zod";
import {
  issueStatuses,
  issueWorkflowStates,
  rfiStatuses,
} from "@/lib/issues/workflow";
import {
  riskMetadataPatchSchema,
  riskReviewCommandSchema,
  type RiskMetadataPatch,
  type RiskReviewCommand,
} from "@/lib/risks/validation";

export const workflowUpdateSchema = z.object({
  workflow_state: z.enum(issueWorkflowStates).optional(),
  status: z.enum(issueStatuses).optional(),
  rfi_status: z.enum(rfiStatuses).optional(),
  subject: z.string().max(200).nullable().optional(),
  resolution_notes: z.string().max(4000).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  trade: z.string().max(100).nullable().optional(),
  discipline: z.string().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  external_system_url: z.string().max(1000).nullable().optional(),
  draft_rfi: z.string().max(4000).nullable().optional(),
  external_rfi_number: z.string().max(100).nullable().optional(),
  external_url: z.string().max(1000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
});

const issueUpdateSchema = workflowUpdateSchema
  .extend(riskMetadataPatchSchema.shape)
  .extend(riskReviewCommandSchema.shape);

export type WorkflowPatch = z.infer<typeof workflowUpdateSchema>;
export type ParsedIssueUpdateRequest = ReturnType<typeof splitIssueUpdateRequest>;

function hasRiskMetadataPatch(patch: RiskMetadataPatch) {
  return Object.values(patch).some((value) => value !== undefined);
}

function hasWorkflowPatch(patch: WorkflowPatch) {
  return Object.values(patch).some((value) => value !== undefined);
}

function hasReviewCommand(patch: RiskReviewCommand) {
  return patch.mark_reviewed === true;
}

function splitIssueUpdateRequest(parsed: z.infer<typeof issueUpdateSchema>) {
  const workflowPatch = workflowUpdateSchema.parse(parsed);
  const riskPatch = riskMetadataPatchSchema.parse(parsed);
  const reviewPatch = riskReviewCommandSchema.parse(parsed);
  const hasRiskPatch = hasRiskMetadataPatch(riskPatch);
  const hasWorkflowFields = hasWorkflowPatch(workflowPatch);
  const markReviewed = hasReviewCommand(reviewPatch);

  return {
    workflowPatch,
    riskPatch,
    markReviewed,
    hasRiskPatch,
    hasWorkflowFields,
    hasAnyPatch: hasRiskPatch || hasWorkflowFields || markReviewed,
  };
}

export function parseIssueUpdateRequest(input: unknown) {
  return splitIssueUpdateRequest(issueUpdateSchema.parse(input));
}

export function safeParseIssueUpdateRequest(input: unknown) {
  const parsed = issueUpdateSchema.safeParse(input);
  if (!parsed.success) return parsed;

  return {
    success: true as const,
    data: splitIssueUpdateRequest(parsed.data),
  };
}
