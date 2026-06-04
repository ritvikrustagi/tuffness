import { getChatModel, getOpenAIClient } from "@/lib/openai/client";
import {
  riskAgentOutputSchema,
  type RiskAgentOutput,
} from "@/lib/agents/risk/schema";
import { formatChunksForPrompt, type ConstructionTopic } from "@/lib/agents/rfi/topics";
import type { MatchedChunk } from "@/lib/rag/types";

const LLM_TIMEOUT_MS = 45_000;

export class RiskAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: "llm_timeout" | "invalid_json" | "validation_failed"
  ) {
    super(message);
    this.name = "RiskAnalysisError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new RiskAnalysisError("LLM request timed out", "llm_timeout")),
        ms
      )
    ),
  ]);
}

export async function analyzeRiskTopicGroup(
  topic: ConstructionTopic,
  chunks: MatchedChunk[]
): Promise<RiskAgentOutput> {
  const openai = getOpenAIClient();
  const context = formatChunksForPrompt(chunks);

  const systemPrompt = `You are a senior construction professional engineer assisting a project team with an AI risk register scan.

Analyze the document excerpts for the topic: ${topic.label}.

Look ONLY for evidence-backed construction risks that could affect:
- cost exposure
- schedule or blocked work
- coordination
- submittal or owner approval requirements
- possible specification deviation
- possible code, inspection, testing, or life-safety review needs

Rules:
1. Return JSON only matching the required schema.
2. Only report risks clearly supported by the excerpts. Do not speculate or infer facts not visible in the excerpts.
3. If no credible risk exists for this topic, return {"risks": []}.
4. Every risk must cite evidence with exact document_id, document_name, page_number, and a direct quote from the excerpts.
5. Do not provide legal advice, code compliance certification, or a guarantee of compliance. Flag possible compliance risk only for human professional review.
6. risk_category must be one of: drawing_spec_conflict, missing_information, coordination_conflict, submittal_requirement, possible_spec_deviation, owner_design_approval, schedule_constraint, cost_exposure, closeout_risk, other.
7. severity must be low, medium, high, or critical.
8. cost_impact and schedule_impact must be one of: none, low, medium, high, critical.
9. compliance_impact must be one of: none, possible_noncompliance, spec_deviation, code_or_life_safety, submittal_required, owner_approval_required, inspection_or_testing_required, closeout_required.
10. required_artifact must be one of: none, rfi, submittal, test_report, owner_approval, inspection, closeout_document.
11. confidence must be a number from 0 to 1 based only on the strength of cited evidence.
12. evidence_strength must be weak, moderate, or strong.
13. draft_rfi is optional and should only be included when an RFI is the recommended artifact.
14. Do not invent responsible party, trade, spec section, drawing sheet, blocked activity, cost, schedule, or compliance details not visible in the excerpts.
15. Maximum 5 risks per topic.`;

  const userPrompt = `Topic: ${topic.label}

Document excerpts:
${context}

Return JSON:
{
  "risks": [
    {
      "risk_category": "possible_spec_deviation",
      "severity": "high",
      "cost_impact": "medium",
      "schedule_impact": "high",
      "compliance_impact": "code_or_life_safety",
      "required_artifact": "rfi",
      "responsible_party": "Architect",
      "responsible_trade": "doors/hardware",
      "spec_section": "08 11 13",
      "drawing_sheet": "A601",
      "blocked_activity": "Door frame release",
      "summary": "...",
      "description": "...",
      "evidence": [
        {
          "document_id": "uuid",
          "document_name": "...",
          "page_number": 1,
          "quote": "..."
        }
      ],
      "draft_rfi": "...",
      "confidence": 0.85,
      "evidence_strength": "strong",
      "recommended_action": "Review the cited excerpts with the design team before acting."
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
      throw new RiskAnalysisError("Empty LLM response", "invalid_json");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RiskAnalysisError("LLM returned invalid JSON", "invalid_json");
    }

    const validated = riskAgentOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new RiskAnalysisError(
        `Schema validation failed: ${validated.error.message}`,
        "validation_failed"
      );
    }

    return validated.data;
  } catch (err) {
    if (err instanceof RiskAnalysisError) throw err;
    throw new RiskAnalysisError(
      err instanceof Error ? err.message : "LLM analysis failed",
      "invalid_json"
    );
  }
}
