# SaaS Customer Admin Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production SaaS control-plane slice: managed customer accounts, internal platform admin dashboard, customer org settings, onboarding progress, invites, usage health, and audit trail.

**Architecture:** Add focused Supabase tables for platform admins, account metadata, invites, onboarding events, and audit events. Keep business logic in small typed helpers under `apps/web/lib/accounts` and `apps/web/lib/admin`; UI routes consume those helpers instead of assembling giant ad hoc queries in components.

**Tech Stack:** Next.js App Router, React Server Components, Supabase Postgres/RLS, TypeScript, Vitest, existing UI primitives.

---

### File Structure

**Create**
- `supabase/migrations/014_saas_customer_accounts.sql`
- `apps/web/lib/accounts/schema.ts`
- `apps/web/lib/accounts/onboarding.ts`
- `apps/web/lib/accounts/onboarding.test.ts`
- `apps/web/lib/accounts/audit.ts`
- `apps/web/lib/admin/access.ts`
- `apps/web/lib/admin/account-health.ts`
- `apps/web/lib/admin/account-health.test.ts`
- `apps/web/components/admin/account-status-badge.tsx`
- `apps/web/components/admin/admin-account-table.tsx`
- `apps/web/components/admin/admin-account-detail.tsx`
- `apps/web/components/organizations/org-settings-form.tsx`
- `apps/web/components/organizations/org-members-table.tsx`
- `apps/web/components/organizations/org-invites.tsx`
- `apps/web/app/(dashboard)/admin/page.tsx`
- `apps/web/app/(dashboard)/admin/accounts/page.tsx`
- `apps/web/app/(dashboard)/admin/accounts/[organizationId]/page.tsx`
- `apps/web/app/(dashboard)/o/[orgSlug]/settings/page.tsx`
- `apps/web/app/api/admin/accounts/route.ts`
- `apps/web/app/api/admin/accounts/[organizationId]/route.ts`
- `apps/web/app/api/organizations/[orgId]/account/route.ts`
- `apps/web/app/api/organizations/[orgId]/members/route.ts`
- `apps/web/app/api/organizations/[orgId]/invites/route.ts`

**Modify**
- `apps/web/lib/types/database.ts`
- `apps/web/components/layout/app-header.tsx`
- `apps/web/app/(dashboard)/o/[orgSlug]/page.tsx`
- `apps/web/lib/api/organizations.ts`

---

### Task 1: Database Foundation

**Files:**
- Create: `supabase/migrations/014_saas_customer_accounts.sql`
- Modify: `apps/web/lib/types/database.ts`

- [ ] **Step 1: Add migration enums and tables**

Create `014_saas_customer_accounts.sql` with:

```sql
CREATE TYPE account_status AS ENUM ('trial', 'active', 'paused', 'churned');
CREATE TYPE account_plan AS ENUM ('starter', 'growth', 'enterprise', 'internal');
CREATE TYPE company_type AS ENUM ('general_contractor', 'subcontractor', 'owner', 'architect', 'consultant', 'other');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE onboarding_event_source AS ENUM ('system', 'platform_admin', 'org_admin');
CREATE TYPE audit_actor_kind AS ENUM ('platform_admin', 'org_member', 'system');
```

Add `platform_admins`, `organization_accounts`, `organization_invites`, `account_onboarding_events`, and `audit_events` exactly as specified in the design doc.

- [ ] **Step 2: Add access helper SQL**

Add:

```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

- [ ] **Step 3: Add RLS policies**

Policies:
- Platform admins can select/update account metadata for all organizations.
- Organization owners/admins can select/update their own `organization_accounts`.
- Organization members can select a redacted account row for their organization.
- Organization owners/admins can manage invites for their organization.
- Platform admins can read all audit/onboarding events.
- Organization members can read audit/onboarding events for their organization.

- [ ] **Step 4: Update TypeScript database types**

Add:

```ts
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
```

Add interfaces for `PlatformAdmin`, `OrganizationAccount`, `OrganizationInvite`, `AccountOnboardingEvent`, and `AuditEvent`.

- [ ] **Step 5: Commit database foundation**

Run:

```bash
git add supabase/migrations/014_saas_customer_accounts.sql apps/web/lib/types/database.ts
git commit -m "Add SaaS account database foundation"
```

---

### Task 2: Account Domain Helpers

**Files:**
- Create: `apps/web/lib/accounts/schema.ts`
- Create: `apps/web/lib/accounts/onboarding.ts`
- Create: `apps/web/lib/accounts/onboarding.test.ts`
- Create: `apps/web/lib/accounts/audit.ts`

- [ ] **Step 1: Write onboarding tests**

`onboarding.test.ts` should cover:

```ts
expect(getCompletedOnboardingSteps(events)).toContain("organization_profile_completed");
expect(getOnboardingProgress(events).percentComplete).toBe(40);
expect(getMissingOnboardingSteps(events)).toContain("first_risk_scan_completed");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test --workspace=web -- lib/accounts/onboarding.test.ts
```

Expected: fails because `onboarding.ts` does not exist.

- [ ] **Step 3: Implement account schemas**

Create `schema.ts` with literal arrays for account statuses, plans, company types, invite statuses, and onboarding step ids. Export typed constants so UI forms and API validation share one source.

- [ ] **Step 4: Implement onboarding helper**

Create `onboarding.ts` with:

```ts
export function getCompletedOnboardingSteps(events: Pick<AccountOnboardingEvent, "event_type">[]): string[];
export function getMissingOnboardingSteps(events: Pick<AccountOnboardingEvent, "event_type">[]): string[];
export function getOnboardingProgress(events: Pick<AccountOnboardingEvent, "event_type">[]): {
  completed: string[];
  missing: string[];
  percentComplete: number;
};
```

- [ ] **Step 5: Implement audit helper**

Create `audit.ts` with a small `buildAuditEventPayload()` helper that requires `organization_id`, `event_type`, `target_type`, and `metadata`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace=web -- lib/accounts/onboarding.test.ts
git add apps/web/lib/accounts
git commit -m "Add account onboarding helpers"
```

---

### Task 3: Admin Account Health Helpers

**Files:**
- Create: `apps/web/lib/admin/access.ts`
- Create: `apps/web/lib/admin/account-health.ts`
- Create: `apps/web/lib/admin/account-health.test.ts`

- [ ] **Step 1: Write health summary tests**

Test a pure `buildAccountHealthSummary()` function with fixture counts:

```ts
const summary = buildAccountHealthSummary({
  projectCount: 3,
  memberCount: 9,
  documentsProcessed: 42,
  pagesProcessed: 1800,
  aiRunCount: 12,
  failedAiRunCount: 1,
  openHighRiskCount: 4,
  openRfiCount: 6,
  submittalsNeedingReviewCount: 2,
  lastActivityAt: "2026-06-07T10:00:00.000Z",
});
expect(summary.healthLevel).toBe("attention");
expect(summary.primaryConcern).toContain("4 high-risk");
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test --workspace=web -- lib/admin/account-health.test.ts
```

Expected: fails because `account-health.ts` does not exist.

- [ ] **Step 3: Implement admin access helper**

Create `access.ts` with:

```ts
export async function requirePlatformAdmin(supabase: SupabaseClient): Promise<void>;
export async function isPlatformAdmin(supabase: SupabaseClient): Promise<boolean>;
```

Use the SQL function `is_platform_admin()`.

- [ ] **Step 4: Implement account health helper**

Create `account-health.ts` with pure summary functions plus server query helpers:

```ts
export function buildAccountHealthSummary(input: AccountHealthCounts): AccountHealthSummary;
export async function listAdminAccountSummaries(supabase: SupabaseClient): Promise<AdminAccountSummary[]>;
export async function getAdminAccountDetail(supabase: SupabaseClient, organizationId: string): Promise<AdminAccountDetail | null>;
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test --workspace=web -- lib/admin/account-health.test.ts
git add apps/web/lib/admin
git commit -m "Add admin account health helpers"
```

---

### Task 4: Internal Admin Dashboard

**Files:**
- Create: `apps/web/components/admin/account-status-badge.tsx`
- Create: `apps/web/components/admin/admin-account-table.tsx`
- Create: `apps/web/components/admin/admin-account-detail.tsx`
- Create: `apps/web/app/(dashboard)/admin/page.tsx`
- Create: `apps/web/app/(dashboard)/admin/accounts/page.tsx`
- Create: `apps/web/app/(dashboard)/admin/accounts/[organizationId]/page.tsx`
- Create: `apps/web/app/api/admin/accounts/route.ts`
- Create: `apps/web/app/api/admin/accounts/[organizationId]/route.ts`
- Modify: `apps/web/components/layout/app-header.tsx`

- [ ] **Step 1: Add admin route guard to pages**

Each admin page creates a Supabase server client, calls `requirePlatformAdmin(supabase)`, and redirects or returns `notFound()` when unauthorized.

- [ ] **Step 2: Add admin accounts list**

`/admin/accounts` renders:
- search/filter controls.
- account table.
- status badge.
- usage columns.
- links to account detail.

- [ ] **Step 3: Add admin account detail**

`/admin/accounts/[organizationId]` renders:
- company profile.
- status/plan form.
- usage cards.
- projects table.
- risk/RFI/submittal counts.
- internal notes.
- audit timeline.

- [ ] **Step 4: Add admin APIs**

`GET /api/admin/accounts` lists accounts.

`PATCH /api/admin/accounts/[organizationId]` updates `status`, `plan`, account metadata, and internal notes. It must:
- require platform admin.
- write audit event.
- only accept typed status/plan values from `apps/web/lib/accounts/schema.ts`.

- [ ] **Step 5: Add header link**

Show an `Admin` link only when `isPlatformAdmin()` returns true.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace=web
npm run lint
git add apps/web/components/admin 'apps/web/app/(dashboard)/admin' apps/web/app/api/admin apps/web/components/layout/app-header.tsx
git commit -m "Add internal customer admin dashboard"
```

---

### Task 5: Customer Organization Settings

**Files:**
- Create: `apps/web/components/organizations/org-settings-form.tsx`
- Create: `apps/web/components/organizations/org-members-table.tsx`
- Create: `apps/web/components/organizations/org-invites.tsx`
- Create: `apps/web/app/(dashboard)/o/[orgSlug]/settings/page.tsx`
- Create: `apps/web/app/api/organizations/[orgId]/account/route.ts`
- Create: `apps/web/app/api/organizations/[orgId]/members/route.ts`
- Create: `apps/web/app/api/organizations/[orgId]/invites/route.ts`
- Modify: `apps/web/app/(dashboard)/o/[orgSlug]/page.tsx`
- Modify: `apps/web/lib/api/organizations.ts`

- [ ] **Step 1: Add settings page**

`/o/[orgSlug]/settings` loads:
- organization.
- current member role.
- account metadata.
- members.
- pending invites.
- onboarding events.

- [ ] **Step 2: Add account profile form**

Owners/admins can update:
- website.
- company type.
- primary contact name/email.
- billing contact email.

Members/viewers see read-only account summary.

- [ ] **Step 3: Add member table**

Owners/admins can change roles with guardrails:
- cannot demote the only owner.
- admins cannot change owner roles.
- viewers/members cannot change roles.

- [ ] **Step 4: Add invite form**

Owners/admins can create pending invites:
- email.
- role.
- expires in 14 days.

No email delivery in this slice. Pending invites are visible in the UI.

- [ ] **Step 5: Add organization settings link**

Add a `Settings` button/link on `/o/[orgSlug]` for owners/admins.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test --workspace=web
npm run lint
git add apps/web/components/organizations 'apps/web/app/(dashboard)/o' apps/web/app/api/organizations apps/web/lib/api/organizations.ts
git commit -m "Add customer organization settings"
```

---

### Task 6: Final Verification

**Files:**
- All changed files

- [ ] Run full tests:

```bash
npm test --workspace=web
```

- [ ] Run lint:

```bash
npm run lint
```

- [ ] Run production build:

```bash
npm run build
```

- [ ] Run whitespace diff check:

```bash
git diff --check
```

- [ ] Run a local route smoke:

```bash
npm run dev --workspace=web
curl -I http://localhost:3000/admin/accounts
curl -I http://localhost:3000/o/demo/settings
```

Expected unauthenticated behavior: redirect to login without runtime crashes.

- [ ] Commit any final polish:

```bash
git add .
git commit -m "Polish SaaS customer admin control plane"
```
