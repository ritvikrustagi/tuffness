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

  v_current_workflow_state := CASE v_issue.status
    WHEN 'draft_rfi' THEN
      CASE v_existing_rfi_status
        WHEN 'needs_edit' THEN 'needs_edit'
        WHEN 'approved' THEN 'approved'
        ELSE 'draft_rfi'
      END
    WHEN 'submitted' THEN 'submitted'
    WHEN 'answered' THEN 'answered'
    WHEN 'resolved' THEN 'resolved'
    WHEN 'dismissed' THEN 'dismissed'
    WHEN 'acknowledged' THEN 'acknowledged'
    ELSE 'open'
  END;

  v_next_workflow_state := COALESCE(NULLIF(p_patch->>'workflow_state', ''), v_current_workflow_state);

  IF v_next_workflow_state NOT IN (
    'open',
    'acknowledged',
    'draft_rfi',
    'needs_edit',
    'approved',
    'submitted',
    'answered',
    'resolved',
    'dismissed'
  ) THEN
    RAISE EXCEPTION 'Unknown workflow state %', v_next_workflow_state;
  END IF;

  IF NOT (
    v_next_workflow_state = v_current_workflow_state
    OR (v_current_workflow_state = 'open' AND v_next_workflow_state IN ('acknowledged', 'draft_rfi', 'resolved', 'dismissed'))
    OR (v_current_workflow_state = 'acknowledged' AND v_next_workflow_state IN ('draft_rfi', 'resolved', 'dismissed'))
    OR (v_current_workflow_state = 'draft_rfi' AND v_next_workflow_state IN ('needs_edit', 'approved', 'submitted', 'resolved', 'dismissed'))
    OR (v_current_workflow_state = 'needs_edit' AND v_next_workflow_state IN ('draft_rfi', 'approved', 'resolved', 'dismissed'))
    OR (v_current_workflow_state = 'approved' AND v_next_workflow_state IN ('needs_edit', 'submitted', 'resolved', 'dismissed'))
    OR (v_current_workflow_state = 'submitted' AND v_next_workflow_state IN ('answered', 'resolved'))
    OR (v_current_workflow_state = 'answered' AND v_next_workflow_state = 'resolved')
    OR (v_current_workflow_state IN ('resolved', 'dismissed') AND v_next_workflow_state = 'open')
  ) THEN
    RAISE EXCEPTION 'Invalid workflow transition from % to %', v_current_workflow_state, v_next_workflow_state;
  END IF;

  v_next_issue_status := CASE v_next_workflow_state
    WHEN 'open' THEN 'open'::public.issue_status
    WHEN 'acknowledged' THEN 'acknowledged'::public.issue_status
    WHEN 'draft_rfi' THEN 'draft_rfi'::public.issue_status
    WHEN 'needs_edit' THEN 'draft_rfi'::public.issue_status
    WHEN 'approved' THEN 'draft_rfi'::public.issue_status
    WHEN 'submitted' THEN 'submitted'::public.issue_status
    WHEN 'answered' THEN 'answered'::public.issue_status
    WHEN 'resolved' THEN 'resolved'::public.issue_status
    WHEN 'dismissed' THEN 'dismissed'::public.issue_status
    ELSE 'open'::public.issue_status
  END;

  v_next_rfi_status := CASE v_next_workflow_state
    WHEN 'needs_edit' THEN 'needs_edit'::public.rfi_status
    WHEN 'approved' THEN 'approved'::public.rfi_status
    WHEN 'submitted' THEN 'submitted_externally'::public.rfi_status
    WHEN 'answered' THEN 'answered'::public.rfi_status
    WHEN 'resolved' THEN 'closed'::public.rfi_status
    WHEN 'dismissed' THEN 'closed'::public.rfi_status
    ELSE 'draft'::public.rfi_status
  END;

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

  IF v_next_workflow_state IN ('draft_rfi', 'needs_edit', 'approved', 'submitted', 'answered', 'resolved', 'dismissed')
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
