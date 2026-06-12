import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  canManageOrganization,
  isMemberRole,
} from "./organizations";

function readAccountMigration() {
  return readFileSync(
    resolve(process.cwd(), "../../supabase/migrations/014_saas_customer_accounts.sql"),
    "utf8"
  );
}

describe("organization role policy", () => {
  test("keeps role workflow authority in SQL instead of client-side transition code", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/api/organizations.ts"),
      "utf8"
    );
    const migration = readAccountMigration();

    expect(source).not.toContain("canAssignRole");
    expect(source).not.toContain("assignableRolesForTarget");
    expect(migration).toContain("public.get_assignable_organization_member_roles");
    expect(migration).toContain("FROM public.organization_role_transitions");
  });

  test("allows owners and admins to manage organizations", () => {
    expect(canManageOrganization("owner")).toBe(true);
    expect(canManageOrganization("admin")).toBe(true);
  });

  test("rejects invalid and low-privilege role values", () => {
    expect(canManageOrganization("member")).toBe(false);
    expect(isMemberRole("contractor")).toBe(false);
    expect(isMemberRole("viewer")).toBe(true);
  });

  test("SQL member role updates serialize owner demotions per organization", () => {
    const migration = readAccountMigration();
    const functionStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.update_organization_member_role"
    );
    const functionEnd = migration.indexOf("CREATE OR REPLACE FUNCTION", functionStart + 1);
    const functionSql = migration.slice(functionStart, functionEnd);

    expect(functionStart).toBeGreaterThan(-1);
    expect(functionSql).toContain("pg_advisory_xact_lock");
    expect(functionSql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      functionSql.indexOf("SELECT COUNT(*)")
    );
  });
});
