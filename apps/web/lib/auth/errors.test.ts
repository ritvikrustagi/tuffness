import { describe, expect, test } from "vitest";
import { getAuthErrorMessage } from "./errors";

describe("auth errors", () => {
  test("turns browser fetch failures into an actionable Supabase config message", () => {
    expect(getAuthErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Could not reach Supabase Auth. Check NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local and make sure the project is active."
    );
  });

  test("keeps specific authentication errors visible", () => {
    expect(getAuthErrorMessage(new Error("Invalid login credentials"))).toBe(
      "Invalid login credentials"
    );
  });
});
