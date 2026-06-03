import { getEmbeddingModel, getOpenAIClient } from "@/lib/openai/client";

export async function embedQuery(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: getEmbeddingModel(),
    input: text.trim(),
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to generate query embedding");
  }

  return embedding;
}
