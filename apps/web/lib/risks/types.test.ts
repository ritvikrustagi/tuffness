import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
  riskTiers,
} from "./types";
import { riskMetadataPatchFields } from "./validation";

function parseCheckList(sql: string, constraintName: string) {
  const constraintStart = sql.indexOf(`CONSTRAINT ${constraintName}`);
  expect(constraintStart).toBeGreaterThan(-1);

  const inStart = sql.indexOf(" IN (", constraintStart);
  const listStart = sql.indexOf("(", inStart);
  const listEnd = sql.indexOf(")", listStart);
  expect(inStart).toBeGreaterThan(constraintStart);
  expect(listEnd).toBeGreaterThan(listStart);

  return [...sql.slice(listStart, listEnd).matchAll(/'([^']+)'/g)].map(
    (match) => match[1]
  );
}

function parseSqlTextArray(sql: string, marker: string) {
  const markerStart = sql.indexOf(marker);
  expect(markerStart).toBeGreaterThan(-1);

  const arrayStart = sql.indexOf("ARRAY[", markerStart);
  const arrayEnd = sql.indexOf("]", arrayStart);
  expect(arrayStart).toBeGreaterThan(markerStart);
  expect(arrayEnd).toBeGreaterThan(arrayStart);

  return [...sql.slice(arrayStart, arrayEnd).matchAll(/'([^']+)'/g)].map(
    (match) => match[1]
  );
}

describe("risk taxonomy", () => {
  test("matches the SQL constraints enforced by the risk register migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../supabase/migrations/008_ai_risk_register.sql"),
      "utf8"
    );

    expect(parseCheckList(migration, "issues_risk_category_check")).toEqual([
      ...riskCategories,
    ]);
    expect(parseCheckList(migration, "issues_risk_tier_check")).toEqual([...riskTiers]);
    expect(parseCheckList(migration, "issues_cost_impact_check")).toEqual([
      ...impactLevels,
    ]);
    expect(parseCheckList(migration, "issues_schedule_impact_check")).toEqual([
      ...impactLevels,
    ]);
    expect(parseCheckList(migration, "issues_compliance_impact_check")).toEqual([
      ...complianceImpacts,
    ]);
    expect(parseCheckList(migration, "issues_required_artifact_check")).toEqual([
      ...requiredArtifacts,
    ]);
  });

  test("keeps risk metadata write fields aligned with the wrapper RPC", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../../supabase/migrations/011_guard_metadata_only_workflow_updates.sql"
      ),
      "utf8"
    );

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.save_issue_with_risk_metadata"
    );
    expect(migration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.save_issue_workflow("
    );
    expect(migration).toContain("IF p_workflow_patch <> '{}'::JSONB THEN");
    expect(migration).toContain("PERFORM public.save_issue_workflow(");
    expect(parseSqlTextArray(migration, "p_risk_patch ?|")).toEqual([
      ...riskMetadataPatchFields,
    ]);
  });
});
