export type SourcePage = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  sheet_title: string | null;
  text_content: string | null;
  image_url: string | null;
  document: {
    id: string;
    name: string;
    file_name: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseSourcePageResponse(payload: unknown): SourcePage {
  if (!isRecord(payload) || !isRecord(payload.page)) {
    throw new Error("Invalid source page response");
  }

  const page = payload.page;
  const document = page.document;

  if (
    typeof page.id !== "string" ||
    typeof page.page_number !== "number" ||
    !isRecord(document) ||
    typeof document.id !== "string" ||
    typeof document.name !== "string" ||
    typeof document.file_name !== "string"
  ) {
    throw new Error("Invalid source page response");
  }

  return {
    id: page.id,
    page_number: page.page_number,
    sheet_number: nullableString(page.sheet_number),
    sheet_title: nullableString(page.sheet_title),
    text_content: nullableString(page.text_content),
    image_url: nullableString(page.image_url),
    document: {
      id: document.id,
      name: document.name,
      file_name: document.file_name,
    },
  };
}

export async function fetchSourcePage({
  projectId,
  documentId,
  pageNumber,
}: {
  projectId: string;
  documentId: string;
  pageNumber: number;
}): Promise<SourcePage> {
  const response = await fetch(
    `/api/projects/${projectId}/documents/${documentId}/pages/${pageNumber}`
  );
  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.error === "string" ? data.error : "Source page unavailable";
    throw new Error(message);
  }

  return parseSourcePageResponse(data);
}
