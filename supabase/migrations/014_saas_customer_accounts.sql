-- Phase 14: SaaS customer account control plane

CREATE TYPE account_status AS ENUM ('trial', 'active', 'paused', 'churned');
CREATE TYPE account_plan AS ENUM ('starter', 'growth', 'enterprise', 'internal');
CREATE TYPE company_type AS ENUM (
  'general_contractor',
  'subcontractor',
  'owner',
  'architect',
  'consultant',
  'other'
);
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE onboarding_event_source AS ENUM ('system', 'platform_admin', 'org_admin');
CREATE TYPE audit_actor_kind AS ENUM ('platform_admin', 'org_member', 'system');

CREATE TABLE public.platform_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id)
);

CREATE INDEX idx_platform_admins_user
  ON public.platform_admins(user_id);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE TABLE public.organization_accounts (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  status account_status NOT NULL DEFAULT 'trial',
  plan account_plan NOT NULL DEFAULT 'starter',
  company_type company_type NOT NULL DEFAULT 'general_contractor',
  website TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  billing_contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organization_accounts_website_length CHECK (
    website IS NULL OR length(website) <= 500
  ),
  CONSTRAINT organization_accounts_primary_contact_email_format CHECK (
    primary_contact_email IS NULL OR primary_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT organization_accounts_billing_contact_email_format CHECK (
    billing_contact_email IS NULL OR billing_contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

CREATE TRIGGER organization_accounts_updated_at
  BEFORE UPDATE ON public.organization_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_organization_accounts_status
  ON public.organization_accounts(status);
CREATE INDEX idx_organization_accounts_plan
  ON public.organization_accounts(plan);

CREATE TABLE public.organization_account_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organization_account_notes_org
  ON public.organization_account_notes(organization_id, created_at DESC);

CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  status invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

  CONSTRAINT organization_invites_email_format CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT organization_invites_acceptance_consistency CHECK (
    (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
    OR (status <> 'accepted')
  )
);

CREATE UNIQUE INDEX idx_organization_invites_pending_email
  ON public.organization_invites(organization_id, lower(email))
  WHERE status = 'pending';
CREATE INDEX idx_organization_invites_org
  ON public.organization_invites(organization_id, created_at DESC);
CREATE INDEX idx_organization_invites_email
  ON public.organization_invites(lower(email));

CREATE TABLE public.account_onboarding_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source onboarding_event_source NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT account_onboarding_events_event_type_format CHECK (
    event_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  )
);

CREATE INDEX idx_account_onboarding_events_org
  ON public.account_onboarding_events(organization_id, created_at DESC);
CREATE UNIQUE INDEX idx_account_onboarding_events_unique_step
  ON public.account_onboarding_events(organization_id, event_type);

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_kind audit_actor_kind NOT NULL DEFAULT 'org_member',
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_events_event_type_format CHECK (
    event_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  ),
  CONSTRAINT audit_events_target_type_format CHECK (
    target_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  )
);

CREATE INDEX idx_audit_events_org
  ON public.audit_events(organization_id, created_at DESC);
CREATE INDEX idx_audit_events_actor
  ON public.audit_events(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_events_target
  ON public.audit_events(target_type, target_id);

CREATE TABLE public.organization_role_transitions (
  actor_role member_role NOT NULL,
  target_role member_role NOT NULL,
  next_role member_role NOT NULL,
  PRIMARY KEY (actor_role, target_role, next_role)
);

INSERT INTO public.organization_role_transitions (actor_role, target_role, next_role)
VALUES
  ('owner', 'owner', 'owner'),
  ('owner', 'owner', 'admin'),
  ('owner', 'owner', 'member'),
  ('owner', 'owner', 'viewer'),
  ('owner', 'admin', 'owner'),
  ('owner', 'admin', 'admin'),
  ('owner', 'admin', 'member'),
  ('owner', 'admin', 'viewer'),
  ('owner', 'member', 'owner'),
  ('owner', 'member', 'admin'),
  ('owner', 'member', 'member'),
  ('owner', 'member', 'viewer'),
  ('owner', 'viewer', 'owner'),
  ('owner', 'viewer', 'admin'),
  ('owner', 'viewer', 'member'),
  ('owner', 'viewer', 'viewer'),
  ('admin', 'admin', 'admin'),
  ('admin', 'admin', 'member'),
  ('admin', 'admin', 'viewer'),
  ('admin', 'member', 'admin'),
  ('admin', 'member', 'member'),
  ('admin', 'member', 'viewer'),
  ('admin', 'viewer', 'admin'),
  ('admin', 'viewer', 'member'),
  ('admin', 'viewer', 'viewer')
ON CONFLICT (actor_role, target_role, next_role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_assign_organization_member_role(
  p_actor_role public.member_role,
  p_target_role public.member_role,
  p_next_role public.member_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_role_transitions transition
    WHERE transition.actor_role = p_actor_role
      AND transition.target_role = p_target_role
      AND transition.next_role = p_next_role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_assignable_organization_member_roles(
  p_organization_id UUID,
  p_member_id UUID
)
RETURNS public.member_role[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH actor AS (
    SELECT role
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ),
  target AS (
    SELECT role
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND id = p_member_id
  )
  SELECT COALESCE(
    ARRAY_AGG(
      transition.next_role
      ORDER BY CASE transition.next_role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
        WHEN 'viewer' THEN 4
      END
    ),
    ARRAY[]::public.member_role[]
  )
  FROM actor
  CROSS JOIN target
  JOIN public.organization_role_transitions transition
    ON transition.actor_role = actor.role
   AND transition.target_role = target.role;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_account_summary_count(
  p_organization_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_status public.account_status DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.organizations org
  LEFT JOIN public.organization_accounts account
    ON account.organization_id = org.id
  WHERE public.is_platform_admin()
    AND (p_organization_id IS NULL OR org.id = p_organization_id)
    AND (p_status IS NULL OR account.status = p_status)
    AND (
      NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
      OR org.name ILIKE '%' || BTRIM(p_search) || '%'
      OR org.slug ILIKE '%' || BTRIM(p_search) || '%'
      OR account.primary_contact_email ILIKE '%' || BTRIM(p_search) || '%'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_platform_account_summaries(
  p_organization_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_status public.account_status DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  organization_created_at TIMESTAMPTZ,
  organization_updated_at TIMESTAMPTZ,
  account_status public.account_status,
  account_plan public.account_plan,
  account_company_type public.company_type,
  account_website TEXT,
  account_primary_contact_name TEXT,
  account_primary_contact_email TEXT,
  account_billing_contact_email TEXT,
  account_created_at TIMESTAMPTZ,
  account_updated_at TIMESTAMPTZ,
  project_count BIGINT,
  member_count BIGINT,
  documents_processed BIGINT,
  pages_processed BIGINT,
  ai_run_count BIGINT,
  failed_ai_run_count BIGINT,
  open_high_risk_count BIGINT,
  open_rfi_count BIGINT,
  submittals_needing_review_count BIGINT,
  last_activity_at TIMESTAMPTZ,
  onboarding_event_types TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH filtered_orgs AS (
    SELECT org.*
    FROM public.organizations org
    LEFT JOIN public.organization_accounts account
      ON account.organization_id = org.id
    WHERE public.is_platform_admin()
      AND (p_organization_id IS NULL OR org.id = p_organization_id)
      AND (p_status IS NULL OR account.status = p_status)
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR org.name ILIKE '%' || BTRIM(p_search) || '%'
        OR org.slug ILIKE '%' || BTRIM(p_search) || '%'
        OR account.primary_contact_email ILIKE '%' || BTRIM(p_search) || '%'
      )
  ),
  page AS (
    SELECT *
    FROM filtered_orgs
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
    OFFSET GREATEST(0, COALESCE(p_offset, 0))
  )
  SELECT
    org.id,
    org.name,
    org.slug,
    org.created_at,
    org.updated_at,
    account.status,
    account.plan,
    account.company_type,
    account.website,
    account.primary_contact_name,
    account.primary_contact_email,
    account.billing_contact_email,
    account.created_at,
    account.updated_at,
    COALESCE(projects.project_count, 0),
    COALESCE(members.member_count, 0),
    COALESCE(documents.documents_processed, 0),
    COALESCE(documents.pages_processed, 0),
    COALESCE(agent_runs.ai_run_count, 0),
    COALESCE(agent_runs.failed_ai_run_count, 0),
    COALESCE(issues.open_high_risk_count, 0),
    COALESCE(rfis.open_rfi_count, 0),
    COALESCE(submittals.submittals_needing_review_count, 0),
    (
      SELECT MAX(activity_at)
      FROM (
        VALUES
          (org.updated_at),
          (account.updated_at),
          (projects.last_activity_at),
          (documents.last_activity_at),
          (issues.last_activity_at),
          (rfis.last_activity_at),
          (submittals.last_activity_at),
          (agent_runs.last_activity_at)
      ) AS activity(activity_at)
	    ),
	    COALESCE(onboarding.event_types, ARRAY[]::TEXT[])
	  FROM page org
	  LEFT JOIN public.organization_accounts account
    ON account.organization_id = org.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS member_count
    FROM public.organization_members member
    WHERE member.organization_id = org.id
  ) members ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS project_count, MAX(project.updated_at) AS last_activity_at
    FROM public.projects project
    WHERE project.organization_id = org.id
  ) projects ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE document.status = 'ready') AS documents_processed,
      COALESCE(SUM(document.page_count), 0) AS pages_processed,
      MAX(document.updated_at) AS last_activity_at
    FROM public.documents document
    WHERE document.organization_id = org.id
  ) documents ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (
        WHERE issue.status NOT IN ('resolved', 'dismissed')
          AND (
            issue.risk_tier IN ('high', 'critical')
            OR issue.severity IN ('high', 'critical')
          )
      ) AS open_high_risk_count,
      MAX(issue.updated_at) AS last_activity_at
    FROM public.issues issue
    WHERE issue.organization_id = org.id
  ) issues ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE rfi.status NOT IN ('answered', 'closed')) AS open_rfi_count,
      MAX(rfi.updated_at) AS last_activity_at
    FROM public.rfis rfi
    WHERE rfi.organization_id = org.id
  ) rfis ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE submittal.review_status IN ('pending', 'warning', 'fail')) AS submittals_needing_review_count,
      MAX(submittal.updated_at) AS last_activity_at
    FROM public.submittals submittal
    WHERE submittal.organization_id = org.id
  ) submittals ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS ai_run_count,
      COUNT(*) FILTER (WHERE agent_run.status = 'failed') AS failed_ai_run_count,
      MAX(COALESCE(agent_run.completed_at, agent_run.started_at, agent_run.created_at)) AS last_activity_at
    FROM public.agent_runs agent_run
    WHERE agent_run.organization_id = org.id
  ) agent_runs ON TRUE
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT event.event_type ORDER BY event.event_type) AS event_types
    FROM public.account_onboarding_events event
    WHERE event.organization_id = org.id
  ) onboarding ON TRUE
  ORDER BY org.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_organization_account(
  p_organization_id UUID,
  p_status public.account_status DEFAULT NULL,
  p_plan public.account_plan DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS public.organization_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.organization_accounts%ROWTYPE;
  v_note TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_note := NULLIF(BTRIM(COALESCE(p_note, '')), '');

  INSERT INTO public.organization_accounts (organization_id, status, plan)
  VALUES (
    p_organization_id,
    COALESCE(p_status, 'trial'::public.account_status),
    COALESCE(p_plan, 'starter'::public.account_plan)
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET
    status = COALESCE(p_status, public.organization_accounts.status),
    plan = COALESCE(p_plan, public.organization_accounts.plan)
  RETURNING * INTO v_account;

  IF v_note IS NOT NULL THEN
    INSERT INTO public.organization_account_notes (organization_id, note, created_by)
    VALUES (p_organization_id, v_note, auth.uid());
  END IF;

  INSERT INTO public.audit_events (
    organization_id,
    actor_user_id,
    actor_kind,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'platform_admin',
    'account_updated',
    'organization',
    p_organization_id,
    jsonb_build_object(
      'status', p_status,
      'plan', p_plan,
      'note_added', v_note IS NOT NULL
    )
  );

  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_account_profile(
  p_organization_id UUID,
  p_company_type public.company_type,
  p_website TEXT DEFAULT NULL,
  p_primary_contact_name TEXT DEFAULT NULL,
  p_primary_contact_email TEXT DEFAULT NULL,
  p_billing_contact_email TEXT DEFAULT NULL
)
RETURNS public.organization_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.organization_accounts%ROWTYPE;
BEGIN
  IF NOT public.is_org_admin(p_organization_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.organization_accounts (
    organization_id,
    company_type,
    website,
    primary_contact_name,
    primary_contact_email,
    billing_contact_email
  )
  VALUES (
    p_organization_id,
    p_company_type,
    NULLIF(BTRIM(COALESCE(p_website, '')), ''),
    NULLIF(BTRIM(COALESCE(p_primary_contact_name, '')), ''),
    NULLIF(BTRIM(COALESCE(p_primary_contact_email, '')), ''),
    NULLIF(BTRIM(COALESCE(p_billing_contact_email, '')), '')
  )
  ON CONFLICT (organization_id) DO UPDATE
  SET
    company_type = EXCLUDED.company_type,
    website = EXCLUDED.website,
    primary_contact_name = EXCLUDED.primary_contact_name,
    primary_contact_email = EXCLUDED.primary_contact_email,
    billing_contact_email = EXCLUDED.billing_contact_email
  RETURNING * INTO v_account;

  IF v_account.primary_contact_name IS NOT NULL
    AND v_account.primary_contact_email IS NOT NULL
  THEN
    INSERT INTO public.account_onboarding_events (
      organization_id,
      event_type,
      source,
      created_by,
      metadata
    )
    VALUES (
      p_organization_id,
      'organization_profile_completed',
      'org_admin',
      auth.uid(),
      '{}'::jsonb
    )
    ON CONFLICT (organization_id, event_type) DO NOTHING;
  END IF;

  INSERT INTO public.audit_events (
    organization_id,
    actor_user_id,
    actor_kind,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'org_member',
    'organization_account_updated',
    'organization',
    p_organization_id,
    jsonb_build_object(
      'fields',
      ARRAY[
        'organization_id',
        'company_type',
        'website',
        'primary_contact_name',
        'primary_contact_email',
        'billing_contact_email'
      ]
    )
  );

  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_invite(
  p_organization_id UUID,
  p_email TEXT,
  p_role public.member_role DEFAULT 'member'
)
RETURNS public.organization_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_email TEXT;
BEGIN
  IF NOT public.is_org_admin(p_organization_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Owner cannot be assigned through an invite' USING ERRCODE = '42501';
  END IF;

  v_email := LOWER(BTRIM(p_email));

  INSERT INTO public.organization_invites (
    organization_id,
    email,
    role,
    invited_by
  )
  VALUES (
    p_organization_id,
    v_email,
    p_role,
    auth.uid()
  )
  RETURNING * INTO v_invite;

  INSERT INTO public.audit_events (
    organization_id,
    actor_user_id,
    actor_kind,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'org_member',
    'organization_invite_created',
    'organization_invite',
    v_invite.id,
    jsonb_build_object('email', v_email, 'role', p_role)
  );

  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_member_role(
  p_organization_id UUID,
  p_member_id UUID,
  p_next_role public.member_role
)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.member_role;
  v_target public.organization_members%ROWTYPE;
  v_member public.organization_members%ROWTYPE;
  v_owner_count INT;
BEGIN
  SELECT role
  INTO v_actor_role
  FROM public.organization_members
  WHERE organization_id = p_organization_id
    AND user_id = auth.uid();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id::TEXT, 0));

  SELECT *
  INTO v_target
  FROM public.organization_members
  WHERE organization_id = p_organization_id
    AND id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_assign_organization_member_role(v_actor_role, v_target.role, p_next_role) THEN
    RAISE EXCEPTION 'You cannot assign that role' USING ERRCODE = '42501';
  END IF;

  IF v_target.role = 'owner' AND p_next_role <> 'owner' THEN
    SELECT COUNT(*)
    INTO v_owner_count
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the only owner' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET role = p_next_role
  WHERE id = p_member_id
    AND organization_id = p_organization_id
  RETURNING * INTO v_member;

  INSERT INTO public.audit_events (
    organization_id,
    actor_user_id,
    actor_kind,
    event_type,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'org_member',
    'organization_member_role_updated',
    'organization_member',
    p_member_id,
    jsonb_build_object('previous_role', v_target.role, 'next_role', p_next_role)
  );

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_organization_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_accounts (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_account_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_account();

INSERT INTO public.organization_accounts (organization_id)
SELECT id
FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_account_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view platform admins"
  ON public.platform_admins FOR SELECT
  USING (public.is_platform_admin() OR user_id = auth.uid());

CREATE POLICY "Platform admins can manage platform admins"
  ON public.platform_admins FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Members can view organization accounts"
  ON public.organization_accounts FOR SELECT
  USING (public.is_org_member(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins can update organization accounts"
  ON public.organization_accounts FOR UPDATE
  USING (public.is_org_admin(organization_id) OR public.is_platform_admin())
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins can create organization accounts"
  ON public.organization_accounts FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Platform admins can view account notes"
  ON public.organization_account_notes FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can create account notes"
  ON public.organization_account_notes FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Org members can view organization invites"
  ON public.organization_invites FOR SELECT
  USING (public.is_org_member(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins can create organization invites"
  ON public.organization_invites FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins can update organization invites"
  ON public.organization_invites FOR UPDATE
  USING (public.is_org_admin(organization_id) OR public.is_platform_admin())
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org members can view onboarding events"
  ON public.account_onboarding_events FOR SELECT
  USING (public.is_org_member(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins can create onboarding events"
  ON public.account_onboarding_events FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org members can view audit events"
  ON public.audit_events FOR SELECT
  USING (
    public.is_platform_admin()
    OR (
      organization_id IS NOT NULL
      AND public.is_org_member(organization_id)
    )
  );

CREATE POLICY "Org admins can create audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organization_id IS NOT NULL
      AND public.is_org_admin(organization_id)
    )
  );
