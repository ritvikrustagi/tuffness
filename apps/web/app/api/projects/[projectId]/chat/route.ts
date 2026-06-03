import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { getChatModel, getOpenAIClient } from "@/lib/openai/client";
import { embedQuery } from "@/lib/rag/embed";
import { buildRagMessages } from "@/lib/rag/prompt";
import { searchChunks } from "@/lib/rag/search";
import type { ChatRequest, ChatStreamEvent, Citation } from "@/lib/rag/types";
import { toCitation } from "@/lib/rag/types";

const MAX_MESSAGE_LENGTH = 4000;

function sseEncode(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `message exceeds ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const { data: readyDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "ready");

  if (!readyDocs?.length) {
    return NextResponse.json(
      { error: "No processed documents available. Upload and process PDFs first." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const embedding = await embedQuery(message);
        const chunks = await searchChunks(supabase, {
          projectId,
          embedding,
          documentIds: body.document_ids,
        });

        const citations: Citation[] = chunks.map((chunk) => toCitation(chunk));
        const { system, user } = buildRagMessages(message, chunks);

        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
          model: getChatModel(),
          temperature: 0.2,
          stream: true,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });

        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(
              encoder.encode(sseEncode({ type: "text", content: delta }))
            );
          }
        }

        controller.enqueue(
          encoder.encode(sseEncode({ type: "citations", citations }))
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Chat failed";
        controller.enqueue(
          encoder.encode(sseEncode({ type: "error", error: errorMessage }))
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
