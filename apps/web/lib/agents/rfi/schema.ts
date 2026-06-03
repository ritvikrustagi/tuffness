import { z } from "zod";

export const rfiEvidenceSchema = z.object({
  document_id: z.string().uuid(),
  document_name: z.string().min(1),
  page_number: z.number().int().positive(),
  quote: z.string().min(1),
});

export const rfiIssueSchema = z.object({
  issue_type: z.enum([
    "drawing_spec_conflict",
    "missing_info",
    "code_conflict",
    "coordination",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string().min(1).max(500),
  description: z.string().min(1).max(2000).optional(),
  evidence: z.array(rfiEvidenceSchema).min(1).max(10),
  draft_rfi: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional(),
  trade: z.string().min(1).max(100).optional(),
  recommended_action: z.string().min(1).max(1000).optional(),
});

export const rfiAgentOutputSchema = z.object({
  issues: z.array(rfiIssueSchema).max(5),
});

export type RfiAgentIssue = z.infer<typeof rfiIssueSchema>;
export type RfiAgentOutput = z.infer<typeof rfiAgentOutputSchema>;
export type RfiEvidence = z.infer<typeof rfiEvidenceSchema>;
