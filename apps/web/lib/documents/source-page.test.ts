import { describe, expect, test } from "vitest";
import { parseSourcePageResponse } from "./source-page";

describe("source page client payloads", () => {
  test("accepts the source page shape returned by the API", () => {
    expect(
      parseSourcePageResponse({
        page: {
          id: "page-1",
          page_number: 4,
          sheet_number: "A601",
          sheet_title: "Door Schedule",
          text_content: "Door 101 hardware set is omitted.",
          image_url: "https://signed.example/page.png",
          document: {
            id: "doc-1",
            name: "Drawings",
            file_name: "drawings.pdf",
          },
        },
      })
    ).toEqual({
      id: "page-1",
      page_number: 4,
      sheet_number: "A601",
      sheet_title: "Door Schedule",
      text_content: "Door 101 hardware set is omitted.",
      image_url: "https://signed.example/page.png",
      document: {
        id: "doc-1",
        name: "Drawings",
        file_name: "drawings.pdf",
      },
    });
  });

  test("rejects malformed payloads before the component renders them", () => {
    expect(() => parseSourcePageResponse({ page: { id: "page-1" } })).toThrow(
      "Invalid source page response"
    );
  });
});
