export type MemberRole = "owner" | "admin" | "member" | "viewer";
export type ProjectStatus = "active" | "archived";
export type DocumentType = "spec" | "drawing" | "submittal" | "other";
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

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

export type IssueType =
  | "drawing_spec_conflict"
  | "missing_info"
  | "code_conflict"
  | "coordination"
  | "other";

export type IssueSeverity = "low" | "medium" | "high" | "critical";
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
export type AgentType = "rfi_scan" | "rfi_agent" | "submittal_review" | "document_process";
export type AgentRunStatus = "pending" | "running" | "completed" | "failed";

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
