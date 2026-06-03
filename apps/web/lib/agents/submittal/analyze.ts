import { getChatModel, getOpenAIClient } from "@/lib/openai/client";
import {
  submittalReviewOutputSchema,
  type SubmittalCategory,
  type SubmittalReviewOutput,
} from "@/lib/agents/submittal/schema";
import {
  formatSpecChunksForPrompt,
  formatSubmittalChunksForPrompt,
  type ReviewContext,
} from "@/lib/agents/submittal/retrieval";

const LLM_TIMEOUT_MS = 60_000;

export class SubmittalAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: "llm_timeout" | "invalid_json" | "validation_failed"
  ) {
    super(message);
    this.name = "SubmittalAnalysisError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new SubmittalAnalysisError("LLM request timed out", "llm_timeout")),
        ms
      )
    ),
  ]);
}

export async function analyzeSubmittalReview(params: {
  submittalTitle: string;
  category: SubmittalCategory | null;
  context: ReviewContext;
}): Promise<SubmittalReviewOutput> {
  const openai = getOpenAIClient();
  const submittalContext = formatSubmittalChunksForPrompt(params.context.submittalChunks);
  const specContext = formatSpecChunksForPrompt(params.context.specChunks);

  const systemPrompt = `You are a construction submittal reviewer assisting a human reviewer.

Compare the submittal excerpts against the specification excerpts ONLY.

Rules:
1. Return JSON only matching the required schema.
2. Do not approve automatically — provide structured findings for human approval.
3. Each item must compare a specific spec requirement to what the submittal states.
4. status must be pass, warning, fail, or unknown.
5. evidence must cite exact document_id, document_name, page_number, and quote from the excerpts.
6. evidence.source must be "spec" or "submittal".
7. overall_status guidance:
   - approved: no fail items, only pass/low warnings
   - approved_as_noted: minor warnings only
   - revise_and_resubmit: one or more fail/warning items needing correction
   - rejected: major non-compliance or missing critical data
8. If insufficient data, use status unknown and explain in recommendation.
9. Maximum 12 items.`;

  const userPrompt = `Submittal title: ${params.submittalTitle}
Category: ${params.category ?? "other"}

Specification excerpts:
${specContext}

Submittal excerpts:
${submittalContext}

Return JSON:
{
  "overall_status": "approved_as_noted",
  "summary": "...",
  "items": [
    {
      "requirement": "...",
      "submitted_value": "...",
      "status": "warning",
      "severity": "medium",
      "evidence": [
        {
          "source": "spec",
          "document_id": "uuid",
          "document_name": "...",
          "page_number": 1,
          "quote": "..."
        }
      ],
      "recommendation": "..."
    }
  ]
}`;

  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: getChatModel(),
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      LLM_TIMEOUT_MS
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new SubmittalAnalysisError("Empty LLM response", "invalid_json");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SubmittalAnalysisError("LLM returned invalid JSON", "invalid_json");
    }

    const validated = submittalReviewOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new SubmittalAnalysisError(
        `Schema validation failed: ${validated.error.message}`,
        "validation_failed"
      );
    }

    return validated.data;
  } catch (err) {
    if (err instanceof SubmittalAnalysisError) throw err;
    throw new SubmittalAnalysisError(
      err instanceof Error ? err.message : "Submittal analysis failed",
      "invalid_json"
    );
  }
}
