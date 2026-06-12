import { describe, expect, test } from "vitest";
import {
  buildAssignableRolesByMemberId,
  unwrapSupabaseResult,
} from "./settings";
import type { OrganizationMember } from "@/lib/types/database";

describe("organization settings loader helpers", () => {
  test("unwraps Supabase results and includes context in thrown errors", async () => {
    await expect(
      unwrapSupabaseResult(
        { data: null, error: { message: "permission denied" } },
        "load organization invites"
      )
    ).rejects.toThrow("load organization invites: permission denied");
  });

  test("loads assignable member roles from the database policy RPC", async () => {
    const members = [
      {
        id: "member-1",
        organization_id: "org-1",
        user_id: "user-1",
        role: "member",
        created_at: "2026-06-01T00:00:00.000Z",
      },
    ] satisfies OrganizationMember[];
    const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (name: string, params: Record<string, unknown>) => {
        calls.push({ name, params });
        return { data: ["admin", "member", "viewer"], error: null };
      },
    };

    await expect(
      buildAssignableRolesByMemberId(supabase as never, "org-1", members)
    ).resolves.toEqual({
      "member-1": ["admin", "member", "viewer"],
    });
    expect(calls).toEqual([
      {
        name: "get_assignable_organization_member_roles",
        params: {
          p_organization_id: "org-1",
          p_member_id: "member-1",
        },
      },
    ]);
  });
});
