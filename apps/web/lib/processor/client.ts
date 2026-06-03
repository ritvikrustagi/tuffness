interface ProcessDocumentPayload {
  documentId: string;
  storagePath: string;
  projectId: string;
  organizationId: string;
}

export async function triggerDocumentProcessing(
  payload: ProcessDocumentPayload
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.PROCESSOR_API_URL;
  const apiKey = process.env.PROCESSOR_API_KEY;

  if (!url || !apiKey) {
    return { ok: false, error: "Processor not configured" };
  }

  try {
    const response = await fetch(`${url}/process/document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        document_id: payload.documentId,
        storage_path: payload.storagePath,
        project_id: payload.projectId,
        organization_id: payload.organizationId,
        options: {
          chunk_size_tokens: 512,
          chunk_overlap_tokens: 64,
          generate_page_images: true,
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: (data as { detail?: string }).detail ?? response.statusText,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Processor request failed",
    };
  }
}
