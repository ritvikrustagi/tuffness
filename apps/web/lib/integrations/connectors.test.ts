import { describe, expect, test } from "vitest";
import {
  connectorOperations,
  getConnectorCapabilities,
  getRecommendedConnectorRollout,
} from "./connectors";

describe("integration connector contract", () => {
  test("keeps manual mode first because it requires no external API", () => {
    const rollout = getRecommendedConnectorRollout();

    expect(rollout[0]).toBe("manual");
    expect(getConnectorCapabilities("manual")).toMatchObject({
      provider: "manual",
      requires_api: false,
      supports_manual_mode: true,
      supports_writeback: false,
    });
  });

  test("defines the minimum connector operations for future adapters", () => {
    expect(connectorOperations).toEqual([
      "connect_account",
      "list_projects",
      "map_project",
      "import_documents",
      "import_rfis",
      "export_rfi",
      "sync_rfi_status",
      "disconnect_account",
    ]);
  });

  test("marks formal RFI system connectors as API-backed and human-approved for writeback", () => {
    expect(getConnectorCapabilities("procore")).toMatchObject({
      provider: "procore",
      requires_api: true,
      supports_import: true,
      supports_writeback: true,
      writeback_requires_approval: true,
    });
  });
});
