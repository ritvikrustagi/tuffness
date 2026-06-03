import { z } from "zod";

export const submittalReviewEvidenceSchema = z.object({
  source: z.enum(["spec", "submittal"]),
  document_id: z.string().uuid(),
  document_name: z.string().min(1),
  page_number: z.number().int().positive(),
  quote: z.string().min(1),
});

export const submittalReviewItemSchema = z.object({
  requirement: z.string().min(1).max(1000),
  submitted_value: z.string().min(1).max(1000),
  status: z.enum(["pass", "warning", "fail", "unknown"]),
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.array(submittalReviewEvidenceSchema).min(1).max(10),
  recommendation: z.string().min(1).max(2000),
});

export const submittalReviewOutputSchema = z.object({
  overall_status: z.enum([
    "approved",
    "approved_as_noted",
    "revise_and_resubmit",
    "rejected",
  ]),
  summary: z.string().min(1).max(2000),
  items: z.array(submittalReviewItemSchema).max(20),
});

export type SubmittalReviewOutput = z.infer<typeof submittalReviewOutputSchema>;
export type SubmittalReviewItem = z.infer<typeof submittalReviewItemSchema>;
export type SubmittalReviewEvidence = z.infer<typeof submittalReviewEvidenceSchema>;

export const SUBMITTAL_CATEGORIES = [
  "HVAC",
  "electrical",
  "plumbing",
  "doors/hardware",
  "finishes",
  "structural",
  "other",
] as const;

export type SubmittalCategory = (typeof SUBMITTAL_CATEGORIES)[number];

export function mapOverallStatusToReviewStatus(
  overall: SubmittalReviewOutput["overall_status"]
): "pass" | "warning" | "fail" {
  switch (overall) {
    case "approved":
      return "pass";
    case "approved_as_noted":
      return "warning";
    case "revise_and_resubmit":
      return "warning";
    case "rejected":
      return "fail";
  }
}
