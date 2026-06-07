# SaaS Customer Admin Control Plane Design

## Goal

Turn AI Project Engineer from a project-level demo into a SaaS product that construction companies can actually be onboarded, managed, monitored, and supported on.

The first production-grade slice is a customer admin control plane: customers can exist as real company accounts, and the platform owner can see account health, usage, onboarding state, and operational risk from one internal dashboard.

## Research Signals

Adjacent GitHub projects show that serious B2B tools need more than feature demos:

- [OpenConstructionERP](https://github.com/datadrivenconstruction/OpenConstructionERP) is broad construction ERP: BOQ, document/BIM workflows, module loader, RBAC, validation, audit log, and many construction modules. The important signal is not to copy every module now; it is that construction buyers expect role control, workflow state, validation, and auditability.
- [OpenProject](https://github.com/opf/openproject) emphasizes planning, scheduling, task collaboration, cost/budget reporting, wikis, meetings, and minutes. The signal for this app is project command-center reporting and accountable workflow history.
- [Leantime](https://github.com/leantime/leantime) shows the SaaS baseline for project management: dashboards, reports, roles, per-project permissions, file storage, API/plugins, and auth hardening.
- [Baserow](https://github.com/baserow/baserow) is API-first and positions around dashboards, automations, self-host/cloud, and compliance. The signal is that every customer-facing capability should eventually become an API/reporting/integration surface, not a one-off screen.

## Product Positioning

This app should not try to beat Procore by becoming all construction software immediately. The wedge is:

> AI project engineer for GC teams that turns drawings, specs, submittals, and project documents into reviewable risks, RFIs, compliance packets, and submittal review packets.

The SaaS control plane makes that wedge usable by real companies:

- Customers can onboard their company and projects.
- Platform admins can manage customers and see health.
- Usage and AI cost are visible enough to support pricing.
- Account status can be trial, active, paused, or churned.
- Every important admin/customer action can be audited later.

## First Slice Scope

### Customer-Facing Features

1. **Organization Settings**
   - Company name, slug, website, billing contact, primary contact, company type, and notes.
   - Read-only account status visible to organization owners/admins.
   - Account onboarding checklist:
     - Organization profile completed.
     - First project created.
     - First document uploaded.
     - First risk scan completed.
     - First RFI/submittal packet exported.

2. **Team Management**
   - Organization owners/admins can see members and roles.
   - Owners/admins can change roles between owner/admin/member/viewer with guardrails.
   - Owners/admins can invite a teammate by email into an organization.
   - Initial invite implementation can be application-level pending invites, not a full email-sending system.

3. **Account Health Summary**
   - Organization dashboard gets a compact health panel:
     - Active projects.
     - Documents processed.
     - Open high/critical risks.
     - Open RFIs.
     - Submittals needing review.
     - Last activity date.

### Internal Platform Admin Features

1. **Platform Admin Gate**
   - Internal admin routes live under `/admin`.
   - Access is restricted to platform admins only.
   - Platform admins are stored in a database table, not hard-coded in UI code.
   - A service-role bootstrap script or SQL insert can create the first admin.

2. **Customer Accounts Dashboard**
   - List organizations as customer accounts.
   - Search by company name, slug, contact email, and plan/status.
   - Show columns:
     - Company.
     - Status.
     - Plan.
     - Seat count.
     - Active projects.
     - Documents/pages processed.
     - AI runs.
     - Open high/critical risks.
     - Last activity.
   - Filter by status: trial, active, paused, churned.

3. **Customer Account Detail**
   - Account profile.
   - Contacts.
   - Team members.
   - Project list.
   - Usage cards.
   - AI activity and failures.
   - Open workflow risk:
     - Open high/critical risks.
     - Draft/submitted RFIs.
     - Submittals in warning/fail.
   - Internal account notes.
   - Audit timeline.

4. **Admin Account Controls**
   - Change account status.
   - Change plan label.
   - Add internal note.
   - Mark onboarding checklist items manually when needed.
   - No destructive deletion in the first slice.

## Data Model

### New Tables

`platform_admins`

- `id`
- `user_id`
- `created_by`
- `created_at`

Purpose: gates internal admin routes and avoids hard-coded admin email checks.

`organization_accounts`

- `organization_id`
- `status`: trial, active, paused, churned
- `plan`: starter, growth, enterprise, internal
- `company_type`: general_contractor, subcontractor, owner, architect, consultant, other
- `website`
- `primary_contact_name`
- `primary_contact_email`
- `billing_contact_email`
- `internal_notes`
- `created_at`
- `updated_at`

Purpose: adds SaaS account metadata without polluting the existing `organizations` table.

`organization_invites`

- `id`
- `organization_id`
- `email`
- `role`
- `status`: pending, accepted, revoked, expired
- `invited_by`
- `accepted_by`
- `created_at`
- `accepted_at`
- `expires_at`

Purpose: allows customer admins to stage team growth without needing full email infrastructure immediately.

`account_onboarding_events`

- `id`
- `organization_id`
- `event_type`
- `source`: system, platform_admin, org_admin
- `metadata`
- `created_by`
- `created_at`

Purpose: records onboarding milestones as events instead of storing a brittle group of booleans.

`audit_events`

- `id`
- `organization_id`
- `actor_user_id`
- `actor_kind`: platform_admin, org_member, system
- `event_type`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

Purpose: gives the product enterprise-grade traceability for admin actions and future compliance/security review.

### Derived Metrics

Do not create a giant metrics table in the first slice. Use typed server helpers that aggregate from existing tables:

- `projects`
- `documents`
- `agent_runs`
- `issues`
- `rfis`
- `submittals`
- `organization_members`
- `audit_events`
- `account_onboarding_events`

If these queries become slow, add SQL views or materialized rollups later.

## Access Control

Customer-facing organization settings follow existing organization roles:

- `owner`: full settings, team management, role changes.
- `admin`: settings and invites, cannot remove/change owners.
- `member`: read-only settings summary.
- `viewer`: read-only settings summary.

Internal admin routes require `is_platform_admin(auth.uid())`.

Platform admins can view all organizations and account metadata. Platform admins should not bypass project-level RLS for customer content in arbitrary screens unless the page is explicitly an admin support surface.

## Routes

Customer routes:

- `/o/[orgSlug]/settings`
- `/api/organizations/[orgId]/account`
- `/api/organizations/[orgId]/members`
- `/api/organizations/[orgId]/invites`

Internal admin routes:

- `/admin`
- `/admin/accounts`
- `/admin/accounts/[organizationId]`
- `/api/admin/accounts`
- `/api/admin/accounts/[organizationId]`
- `/api/admin/accounts/[organizationId]/notes`
- `/api/admin/accounts/[organizationId]/status`

## UI Design

This should feel like a serious operational SaaS tool, not a marketing page.

Customer settings:

- Dense form layout.
- Team table.
- Invite form.
- Onboarding checklist.
- Account health summary.

Internal admin:

- Full-width operational dashboard.
- Search/filter toolbar.
- Account table optimized for scanning.
- Account detail page with compact metric cards, tables, and timeline.
- Status badges with restrained color.

No hero sections, decorative cards, or sales copy inside the app.

## Implementation Order

1. Database migration:
   - enums/tables/functions/RLS.
   - `is_platform_admin()`.
   - account metadata table.
   - invites.
   - audit/onboarding event tables.

2. Server/domain helpers:
   - account summary query helpers.
   - onboarding event helpers.
   - audit event writer.
   - role guard helpers.

3. Internal admin dashboard:
   - `/admin/accounts` list.
   - account status/plan editing.
   - account detail.

4. Customer organization settings:
   - account profile form.
   - team/member list.
   - pending invites.

5. Tests:
   - pure helper tests for health summary, onboarding completion, audit payloads.
   - API guard tests where practical.
   - build/lint verification.

## Non-Goals For This Slice

- Billing provider integration.
- Stripe checkout.
- Email delivery.
- SSO/SAML.
- SOC 2 automation.
- Public API keys.
- Full Procore/Autodesk sync.
- Daily reports, punch lists, HSE logs, schedules, budgets.
- Deleting customer accounts.

These matter later, but adding them now would weaken the wedge.

## Success Criteria

The feature is successful when:

- A construction company can be represented as a managed SaaS account.
- The platform owner can see every customer, their health, usage, and status.
- A customer owner/admin can manage profile and team basics.
- Onboarding progress is visible without manual database inspection.
- Admin actions leave an audit trail.
- The implementation strengthens, not muddies, the existing organization/project architecture.

## Future Expansion

After this first slice, the next startup-grade features should be:

1. Project Command Center:
   - weekly report export.
   - work queue for overdue/open risks, RFIs, submittals.
   - executive project health.

2. Integration Marketplace:
   - Procore, Autodesk Build, SharePoint/OneDrive, Bluebeam.
   - OAuth connection status.
   - project mapping.
   - import/export jobs.

3. Commercial Controls:
   - plan limits.
   - usage-based AI spend.
   - invoices/payment provider.
   - customer success notes and renewal dates.

4. Enterprise Trust:
   - SSO.
   - retention policies.
   - admin audit exports.
   - security page and compliance docs.
