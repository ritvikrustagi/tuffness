export type MemberRole = "owner" | "admin" | "member" | "viewer";
export type ProjectStatus = "active" | "archived";
export type DocumentType = "spec" | "drawing" | "submittal" | "other";
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";
export type AccountStatus = "trial" | "active" | "paused" | "churned";
export type AccountPlan = "starter" | "growth" | "enterprise" | "internal";
export type CompanyType =
  | "general_contractor"
  | "subcontractor"
  | "owner"
  | "architect"
  | "consultant"
  | "other";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type OnboardingEventSource = "system" | "platform_admin" | "org_admin";
export type AuditActorKind = "platform_admin" | "org_member" | "system";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  project_number: string | null;
  address: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  document_type: DocumentType;
  discipline: string | null;
  status: DocumentStatus;
  page_count: number | null;
  error_message: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithRole extends Organization {
  role: MemberRole;
}

export interface PlatformAdmin {
  id: string;
  user_id: string;
  created_by: string | null;
  created_at: string;
}

export interface OrganizationAccount {
  organization_id: string;
  status: AccountStatus;
  plan: AccountPlan;
  company_type: CompanyType;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  billing_contact_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationAccountNote {
  id: string;
  organization_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  invited_by: string | null;
  accepted_by: string | null;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
}

export interface AccountOnboardingEvent {
  id: string;
  organization_id: string;
  event_type: string;
  source: OnboardingEventSource;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_kind: AuditActorKind;
  event_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type IssueType =
  | "drawing_spec_conflict"
  | "missing_info"
  | "code_conflict"
  | "coordination"
  | "other";

export type IssueSeverity = "low" | "medium" | "high" | "critical";
export type RiskCategory =
  | "drawing_spec_conflict"
  | "missing_information"
  | "coordination_conflict"
  | "submittal_requirement"
  | "possible_spec_deviation"
  | "owner_design_approval"
  | "schedule_constraint"
  | "cost_exposure"
  | "closeout_risk"
  | "other";
export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical";
export type ComplianceImpact =
  | "none"
  | "possible_noncompliance"
  | "spec_deviation"
  | "code_or_life_safety"
  | "submittal_required"
  | "owner_approval_required"
  | "inspection_or_testing_required"
  | "closeout_required";
export type RequiredArtifact =
  | "none"
  | "rfi"
  | "submittal"
  | "test_report"
  | "owner_approval"
  | "inspection"
  | "closeout_document";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type IssueStatus =
  | "open"
  | "acknowledged"
  | "draft_rfi"
  | "submitted"
  | "answered"
  | "resolved"
  | "dismissed";
export type RfiStatus =
  | "draft"
  | "needs_edit"
  | "approved"
  | "submitted_externally"
  | "answered"
  | "closed";
export type AgentType = "rfi_scan" | "rfi_agent" | "risk_agent" | "submittal_review" | "document_process";
export type AgentRunStatus = "pending" | "running" | "completed" | "failed";
export type IntegrationProvider =
  | "manual"
  | "email"
  | "procore"
  | "autodesk_build"
  | "sharepoint_onedrive"
  | "bluebeam"
  | "csv";
export type ExternalConnectionStatus = "connected" | "disconnected" | "error";
export type IntegrationOperation =
  | "connect_account"
  | "list_projects"
  | "map_project"
  | "import_documents"
  | "import_rfis"
  | "export_rfi"
  | "sync_rfi_status"
  | "disconnect_account";
export type IntegrationSyncRunStatus = "pending" | "running" | "completed" | "failed";
export type IntegrationSyncEventStatus = "completed" | "failed" | "conflict";

export interface IssueEvidence {
  document_id: string;
  document_name?: string;
  page_number?: number;
  excerpt?: string;
  quote?: string;
}

export type SubmittalReviewStatus = "pending" | "pass" | "warning" | "fail";

export interface SubmittalReviewEvidence {
  source: "spec" | "submittal";
  document_id: string;
  document_name: string;
  page_number: number;
  quote: string;
}

export interface SubmittalReviewItem {
  requirement: string;
  submitted_value: string;
  status: "pass" | "warning" | "fail" | "unknown";
  severity: "low" | "medium" | "high";
  evidence: SubmittalReviewEvidence[];
  recommendation: string;
}

export interface SubmittalReviewResult {
  overall_status:
    | "approved"
    | "approved_as_noted"
    | "revise_and_resubmit"
    | "rejected";
  summary: string;
  items: SubmittalReviewItem[];
}

export interface Submittal {
  id: string;
  project_id: string;
  organization_id: string;
  document_id: string | null;
  submittal_number: string | null;
  spec_section: string | null;
  category: string | null;
  title: string;
  review_status: SubmittalReviewStatus;
  review_summary: string | null;
  review_findings: SubmittalReviewItem[];
  review_result: SubmittalReviewResult | Record<string, unknown>;
  reviewed_at: string | null;
  agent_run_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  documents?: Pick<Document, "id" | "name" | "status" | "file_name" | "page_count"> | null;
}

export interface Issue {
  id: string;
  project_id: string;
  organization_id: string;
  agent_run_id: string | null;
  submittal_id: string | null;
  issue_type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  summary: string;
  description: string | null;
  evidence: IssueEvidence[];
  draft_rfi: string | null;
  owner_id: string | null;
  trade: string | null;
  discipline: string | null;
  due_date: string | null;
  confidence: number | null;
  recommended_action: string | null;
  resolution_notes: string | null;
  external_system_url: string | null;
  risk_category: RiskCategory | null;
  risk_score: number | null;
  risk_tier: RiskTier | null;
  cost_impact: ImpactLevel | null;
  schedule_impact: ImpactLevel | null;
  compliance_impact: ComplianceImpact | null;
  responsible_party: string | null;
  responsible_trade: string | null;
  spec_section: string | null;
  drawing_sheet: string | null;
  required_artifact: RequiredArtifact | null;
  blocked_activity: string | null;
  risk_reasoning: string | null;
  evidence_strength: EvidenceStrength | null;
  human_reviewed_at: string | null;
  human_reviewed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  rfis?: Rfi[];
}

export interface Rfi {
  id: string;
  project_id: string;
  organization_id: string;
  issue_id: string | null;
  rfi_number: string | null;
  subject: string;
  question: string;
  status: RfiStatus;
  response: string | null;
  external_rfi_number: string | null;
  external_url: string | null;
  submitted_at: string | null;
  answered_at: string | null;
  answer_source_document_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  project_id: string;
  organization_id: string;
  agent_type: AgentType;
  status: AgentRunStatus;
  input_params: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  triggered_by: string | null;
  created_at: string;
}

export interface ExternalConnection {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  status: ExternalConnectionStatus;
  account_label: string | null;
  external_account_id: string | null;
  token_reference: string | null;
  metadata: Record<string, unknown>;
  last_sync_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalProjectMapping {
  id: string;
  connection_id: string | null;
  organization_id: string;
  project_id: string;
  provider: IntegrationProvider;
  external_project_id: string;
  external_project_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExternalRecordLink {
  id: string;
  connection_id: string | null;
  organization_id: string;
  project_id: string;
  provider: IntegrationProvider;
  internal_table: "documents" | "issues" | "rfis" | "submittals";
  internal_id: string;
  external_id: string;
  external_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncRun {
  id: string;
  connection_id: string | null;
  organization_id: string;
  project_id: string | null;
  provider: IntegrationProvider;
  operation: IntegrationOperation;
  status: IntegrationSyncRunStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  input_params: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  triggered_by: string | null;
  created_at: string;
}

export interface IntegrationSyncEvent {
  id: string;
  sync_run_id: string;
  organization_id: string;
  project_id: string | null;
  provider: IntegrationProvider;
  event_type: string;
  internal_table: "documents" | "issues" | "rfis" | "submittals" | null;
  internal_id: string | null;
  external_id: string | null;
  status: IntegrationSyncEventStatus;
  error_message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
