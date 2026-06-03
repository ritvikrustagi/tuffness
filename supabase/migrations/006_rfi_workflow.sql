-- Phase 6: RFI copilot workflow hardening

ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'draft_rfi';
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'answered';

ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'needs_edit';
ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'submitted_externally';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS discipline TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS external_system_url TEXT;

ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS external_rfi_number TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answer_source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_owner ON public.issues(project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_issues_trade ON public.issues(project_id, trade);
CREATE INDEX IF NOT EXISTS idx_issues_due_date ON public.issues(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_rfis_external_number ON public.rfis(project_id, external_rfi_number);

CREATE TABLE IF NOT EXISTS public.issue_workflow_states (
  workflow_state TEXT PRIMARY KEY,
  issue_status public.issue_status NOT NULL,
  rfi_status public.rfi_status NOT NULL,
  summary_bucket TEXT NOT NULL,
  creates_rfi BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT issue_workflow_states_summary_bucket_check CHECK (
    summary_bucket IN (
      'open_issues',
      'draft_rfis',
      'submitted_rfis',
      'answered_awaiting_closeout',
      'closed'
    )
  )
);

INSERT INTO public.issue_workflow_states (
  workflow_state,
  issue_status,
  rfi_status,
  summary_bucket,
  creates_rfi
)
VALUES
  ('open', 'open', 'draft', 'open_issues', FALSE),
  ('acknowledged', 'acknowledged', 'draft', 'open_issues', FALSE),
  ('draft_rfi', 'draft_rfi', 'draft', 'draft_rfis', TRUE),
  ('needs_edit', 'draft_rfi', 'needs_edit', 'draft_rfis', TRUE),
  ('approved', 'draft_rfi', 'approved', 'draft_rfis', TRUE),
  ('submitted', 'submitted', 'submitted_externally', 'submitted_rfis', TRUE),
  ('answered', 'answered', 'answered', 'answered_awaiting_closeout', TRUE),
  ('resolved', 'resolved', 'closed', 'closed', TRUE),
  ('dismissed', 'dismissed', 'closed', 'closed', TRUE)
ON CONFLICT (workflow_state) DO UPDATE
SET
  issue_status = EXCLUDED.issue_status,
  rfi_status = EXCLUDED.rfi_status,
  summary_bucket = EXCLUDED.summary_bucket,
  creates_rfi = EXCLUDED.creates_rfi;

CREATE TABLE IF NOT EXISTS public.issue_workflow_transitions (
  current_state TEXT NOT NULL REFERENCES public.issue_workflow_states(workflow_state) ON DELETE CASCADE,
  next_state TEXT NOT NULL REFERENCES public.issue_workflow_states(workflow_state) ON DELETE CASCADE,
  PRIMARY KEY (current_state, next_state)
);

INSERT INTO public.issue_workflow_transitions (current_state, next_state)
VALUES
  ('open', 'acknowledged'),
  ('open', 'draft_rfi'),
  ('open', 'resolved'),
  ('open', 'dismissed'),
  ('acknowledged', 'draft_rfi'),
  ('acknowledged', 'resolved'),
  ('acknowledged', 'dismissed'),
  ('draft_rfi', 'needs_edit'),
  ('draft_rfi', 'approved'),
  ('draft_rfi', 'submitted'),
  ('draft_rfi', 'resolved'),
  ('draft_rfi', 'dismissed'),
  ('needs_edit', 'draft_rfi'),
  ('needs_edit', 'approved'),
  ('needs_edit', 'resolved'),
  ('needs_edit', 'dismissed'),
  ('approved', 'needs_edit'),
  ('approved', 'submitted'),
  ('approved', 'resolved'),
  ('approved', 'dismissed'),
  ('submitted', 'answered'),
  ('submitted', 'resolved'),
  ('answered', 'resolved'),
  ('resolved', 'open'),
  ('dismissed', 'open')
ON CONFLICT (current_state, next_state) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_issue_workflow(
  p_project_id UUID,
  p_issue_id UUID,
  p_user_id UUID,
  p_patch JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_issue public.issues%ROWTYPE;
  v_rfi_id UUID;
  v_existing_rfi_status public.rfi_status;
  v_current_workflow_state TEXT;
  v_next_workflow_state TEXT;
  v_next_issue_status public.issue_status;
  v_next_rfi_status public.rfi_status;
  v_next_creates_rfi BOOLEAN;
  v_transition_allowed BOOLEAN;
  v_question TEXT;
BEGIN
  SELECT *
  INTO v_issue
  FROM public.issues
  WHERE id = p_issue_id
    AND project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  SELECT id, status
  INTO v_rfi_id, v_existing_rfi_status
  FROM public.rfis
  WHERE issue_id = p_issue_id
    AND project_id = p_project_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  SELECT workflow_state
  INTO v_current_workflow_state
  FROM public.issue_workflow_states
  WHERE issue_status = v_issue.status
    AND (
      v_issue.status <> 'draft_rfi'
      OR rfi_status = COALESCE(v_existing_rfi_status, 'draft'::public.rfi_status)
    )
  LIMIT 1;

  v_current_workflow_state := COALESCE(v_current_workflow_state, 'open');

  v_next_workflow_state := COALESCE(NULLIF(p_patch->>'workflow_state', ''), v_current_workflow_state);

  SELECT issue_status, rfi_status, creates_rfi
  INTO v_next_issue_status, v_next_rfi_status, v_next_creates_rfi
  FROM public.issue_workflow_states
  WHERE workflow_state = v_next_workflow_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown workflow state %', v_next_workflow_state;
  END IF;

  SELECT (
    v_next_workflow_state = v_current_workflow_state
    OR EXISTS (
      SELECT 1
      FROM public.issue_workflow_transitions
      WHERE current_state = v_current_workflow_state
        AND next_state = v_next_workflow_state
    )
  )
  INTO v_transition_allowed;

  IF NOT v_transition_allowed THEN
    RAISE EXCEPTION 'Invalid workflow transition from % to %', v_current_workflow_state, v_next_workflow_state;
  END IF;

  IF p_patch ? 'status' AND (p_patch->>'status')::public.issue_status <> v_next_issue_status THEN
    RAISE EXCEPTION 'Issue status does not match workflow state %', v_next_workflow_state;
  END IF;

  IF p_patch ? 'rfi_status' AND (p_patch->>'rfi_status')::public.rfi_status <> v_next_rfi_status THEN
    RAISE EXCEPTION 'RFI status does not match workflow state %', v_next_workflow_state;
  END IF;

  UPDATE public.issues
  SET
    status = v_next_issue_status,
    resolution_notes = CASE
      WHEN p_patch ? 'resolution_notes' THEN NULLIF(p_patch->>'resolution_notes', '')
      ELSE resolution_notes
    END,
    trade = CASE
      WHEN p_patch ? 'trade' THEN NULLIF(p_patch->>'trade', '')
      ELSE trade
    END,
    discipline = CASE
      WHEN p_patch ? 'discipline' THEN NULLIF(p_patch->>'discipline', '')
      ELSE discipline
    END,
    due_date = CASE
      WHEN p_patch ? 'due_date' THEN NULLIF(p_patch->>'due_date', '')::DATE
      ELSE due_date
    END,
    external_system_url = CASE
      WHEN p_patch ? 'external_system_url' THEN NULLIF(p_patch->>'external_system_url', '')
      ELSE external_system_url
    END,
    draft_rfi = CASE
      WHEN p_patch ? 'draft_rfi' THEN NULLIF(p_patch->>'draft_rfi', '')
      ELSE draft_rfi
    END
  WHERE id = p_issue_id
    AND project_id = p_project_id;

  IF v_next_creates_rfi
    OR p_patch ? 'external_rfi_number'
    OR p_patch ? 'external_url'
    OR p_patch ? 'response'
    OR p_patch ? 'draft_rfi'
    OR v_rfi_id IS NOT NULL
  THEN
    v_question := COALESCE(
      NULLIF(p_patch->>'draft_rfi', ''),
      v_issue.draft_rfi,
      'Draft RFI pending human review.'
    );

    IF v_rfi_id IS NULL THEN
      INSERT INTO public.rfis (
        project_id,
        organization_id,
        issue_id,
        subject,
        question,
        status,
        response,
        external_rfi_number,
        external_url,
        submitted_at,
        answered_at,
        created_by
      )
      VALUES (
        p_project_id,
        v_issue.organization_id,
        p_issue_id,
        LEFT(v_issue.summary, 200),
        v_question,
        v_next_rfi_status,
        NULLIF(p_patch->>'response', ''),
        NULLIF(p_patch->>'external_rfi_number', ''),
        NULLIF(p_patch->>'external_url', ''),
        CASE WHEN v_next_rfi_status = 'submitted_externally' THEN NOW() ELSE NULL END,
        CASE WHEN v_next_rfi_status = 'answered' THEN NOW() ELSE NULL END,
        p_user_id
      );
    ELSE
      UPDATE public.rfis
      SET
        status = v_next_rfi_status,
        question = CASE
          WHEN p_patch ? 'draft_rfi' THEN v_question
          ELSE question
        END,
        response = CASE
          WHEN p_patch ? 'response' THEN NULLIF(p_patch->>'response', '')
          ELSE response
        END,
        external_rfi_number = CASE
          WHEN p_patch ? 'external_rfi_number' THEN NULLIF(p_patch->>'external_rfi_number', '')
          ELSE external_rfi_number
        END,
        external_url = CASE
          WHEN p_patch ? 'external_url' THEN NULLIF(p_patch->>'external_url', '')
          ELSE external_url
        END,
        submitted_at = CASE
          WHEN v_next_rfi_status = 'submitted_externally'
            THEN COALESCE(submitted_at, NOW())
          ELSE submitted_at
        END,
        answered_at = CASE
          WHEN v_next_rfi_status = 'answered'
            THEN COALESCE(answered_at, NOW())
          ELSE answered_at
        END
      WHERE id = v_rfi_id;
    END IF;
  END IF;

  RETURN p_issue_id;
END;
$$;
