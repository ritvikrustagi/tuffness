import type {
  ExternalConnection,
  ExternalProjectMapping,
  ExternalRecordLink,
  IntegrationOperation,
  IntegrationProvider,
} from "@/lib/types/database";

export const integrationProviders = [
  "manual",
  "email",
  "procore",
  "autodesk_build",
  "sharepoint_onedrive",
  "bluebeam",
  "csv",
] as const satisfies readonly IntegrationProvider[];

export const connectorOperations = [
  "connect_account",
  "list_projects",
  "map_project",
  "import_documents",
  "import_rfis",
  "export_rfi",
  "sync_rfi_status",
  "disconnect_account",
] as const satisfies readonly IntegrationOperation[];

export type ConnectorCapabilities = {
  provider: IntegrationProvider;
  label: string;
  requires_api: boolean;
  supports_manual_mode: boolean;
  supports_import: boolean;
  supports_writeback: boolean;
  supports_two_way_sync: boolean;
  writeback_requires_approval: boolean;
  supported_operations: IntegrationOperation[];
};

const connectorCapabilities: Record<IntegrationProvider, ConnectorCapabilities> = {
  manual: {
    provider: "manual",
    label: "Manual copy/export",
    requires_api: false,
    supports_manual_mode: true,
    supports_import: false,
    supports_writeback: false,
    supports_two_way_sync: false,
    writeback_requires_approval: true,
    supported_operations: [],
  },
  email: {
    provider: "email",
    label: "Email",
    requires_api: true,
    supports_manual_mode: false,
    supports_import: true,
    supports_writeback: false,
    supports_two_way_sync: false,
    writeback_requires_approval: true,
    supported_operations: ["connect_account", "import_rfis", "sync_rfi_status", "disconnect_account"],
  },
  procore: {
    provider: "procore",
    label: "Procore",
    requires_api: true,
    supports_manual_mode: false,
    supports_import: true,
    supports_writeback: true,
    supports_two_way_sync: true,
    writeback_requires_approval: true,
    supported_operations: [...connectorOperations],
  },
  autodesk_build: {
    provider: "autodesk_build",
    label: "Autodesk Build",
    requires_api: true,
    supports_manual_mode: false,
    supports_import: true,
    supports_writeback: true,
    supports_two_way_sync: true,
    writeback_requires_approval: true,
    supported_operations: [...connectorOperations],
  },
  sharepoint_onedrive: {
    provider: "sharepoint_onedrive",
    label: "SharePoint/OneDrive",
    requires_api: true,
    supports_manual_mode: false,
    supports_import: true,
    supports_writeback: false,
    supports_two_way_sync: false,
    writeback_requires_approval: true,
    supported_operations: [
      "connect_account",
      "list_projects",
      "map_project",
      "import_documents",
      "disconnect_account",
    ],
  },
  bluebeam: {
    provider: "bluebeam",
    label: "Bluebeam",
    requires_api: true,
    supports_manual_mode: false,
    supports_import: true,
    supports_writeback: false,
    supports_two_way_sync: false,
    writeback_requires_approval: true,
    supported_operations: ["connect_account", "map_project", "import_documents", "disconnect_account"],
  },
  csv: {
    provider: "csv",
    label: "CSV import/export",
    requires_api: false,
    supports_manual_mode: true,
    supports_import: true,
    supports_writeback: false,
    supports_two_way_sync: false,
    writeback_requires_approval: true,
    supported_operations: ["import_documents", "import_rfis", "export_rfi"],
  },
};

export type { ExternalConnection, ExternalProjectMapping, ExternalRecordLink };

export function getConnectorCapabilities(provider: IntegrationProvider): ConnectorCapabilities {
  return connectorCapabilities[provider];
}

export function getRecommendedConnectorRollout(): IntegrationProvider[] {
  return [
    "manual",
    "email",
    "procore",
    "autodesk_build",
    "sharepoint_onedrive",
    "bluebeam",
    "csv",
  ];
}
