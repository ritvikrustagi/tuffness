import { getChatModel, getOpenAIClient } from "@/lib/openai/client";
import {
  rfiAgentOutputSchema,
  type RfiAgentOutput,
} from "@/lib/agents/rfi/schema";
import { formatChunksForPrompt, type ConstructionTopic } from "@/lib/agents/rfi/topics";
import type { MatchedChunk } from "@/lib/rag/types";

const LLM_TIMEOUT_MS = 45_000;

export class RfiAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: "llm_timeout" | "invalid_json" | "validation_failed"
  ) {
    super(message);
    this.name = "RfiAnalysisError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new RfiAnalysisError("LLM request timed out", "llm_timeout")), ms)
    ),
  ]);
}

export async function analyzeTopicGroup(
  topic: ConstructionTopic,
  chunks: MatchedChunk[]
): Promise<RfiAgentOutput> {
  const openai = getOpenAIClient();
  const context = formatChunksForPrompt(chunks);

  const systemPrompt = `You are a construction document reviewer assisting with RFI (Request for Information) preparation.

Analyze the document excerpts for the topic: ${topic.label}.

Look ONLY for real, actionable problems:
- drawing/spec conflicts
- missing information
- inconsistent dimensions
- unclear requirements
- schedule mismatches

Rules:
1. Return JSON only matching the required schema.
2. Only report issues clearly supported by the excerpts — do not speculate.
3. If no credible issue exists for this topic, return {"issues": []}.
4. Each issue must cite evidence with exact document_id, document_name, page_number, and a direct quote from the excerpts.
5. draft_rfi must be a formal RFI question ready for human review and submission.
6. issue_type must be one of: drawing_spec_conflict, missing_info, code_conflict, coordination, other.
7. severity must be low, medium, or high.
8. Maximum 3 issues per topic.`;

  const userPrompt = `Topic: ${topic.label}

Document excerpts:
${context}

Return JSON:
{
  "issues": [
    {
      "issue_type": "drawing_spec_conflict",
      "severity": "high",
      "summary": "...",
      "evidence": [
        {
          "document_id": "uuid",
          "document_name": "...",
          "page_number": 1,
          "quote": "..."
        }
      ],
      "draft_rfi": "..."
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
      throw new RfiAnalysisError("Empty LLM response", "invalid_json");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RfiAnalysisError("LLM returned invalid JSON", "invalid_json");
    }

    const validated = rfiAgentOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new RfiAnalysisError(
        `Schema validation failed: ${validated.error.message}`,
        "validation_failed"
      );
    }

    return validated.data;
  } catch (err) {
    if (err instanceof RfiAnalysisError) throw err;
    throw new RfiAnalysisError(
      err instanceof Error ? err.message : "LLM analysis failed",
      "invalid_json"
    );
  }
}
