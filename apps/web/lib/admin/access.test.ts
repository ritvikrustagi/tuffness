import { describe, expect, test } from "vitest";
import {
  getOptionalPlatformAdminFlag,
  isPlatformAdmin,
} from "./access";

describe("platform admin access", () => {
  test("throws when the platform admin RPC fails", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function is missing" } }),
    };

    await expect(isPlatformAdmin(supabase as never)).rejects.toThrow("function is missing");
  });

  test("treats missing platform admin RPC as no admin nav access", async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          message:
            "Could not find the function public.is_platform_admin without parameters in the schema cache",
        },
      }),
    };

    await expect(getOptionalPlatformAdminFlag(supabase as never)).resolves.toBe(false);
  });

  test("does not hide unrelated platform admin RPC failures", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "permission denied" } }),
    };

    await expect(getOptionalPlatformAdminFlag(supabase as never)).rejects.toThrow(
      "permission denied"
    );
  });
});
