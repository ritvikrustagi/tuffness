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
  v_rfi_status public.rfi_status;
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

  UPDATE public.issues
  SET
    status = CASE
      WHEN p_patch ? 'status' THEN (p_patch->>'status')::public.issue_status
      ELSE status
    END,
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

  IF p_patch ? 'rfi_status'
    OR p_patch ? 'external_rfi_number'
    OR p_patch ? 'external_url'
    OR p_patch ? 'response'
    OR p_patch ? 'draft_rfi'
  THEN
    SELECT id
    INTO v_rfi_id
    FROM public.rfis
    WHERE issue_id = p_issue_id
      AND project_id = p_project_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    v_rfi_status := COALESCE(
      NULLIF(p_patch->>'rfi_status', '')::public.rfi_status,
      'draft'::public.rfi_status
    );
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
        v_rfi_status,
        NULLIF(p_patch->>'response', ''),
        NULLIF(p_patch->>'external_rfi_number', ''),
        NULLIF(p_patch->>'external_url', ''),
        CASE WHEN v_rfi_status = 'submitted_externally' THEN NOW() ELSE NULL END,
        CASE WHEN v_rfi_status = 'answered' THEN NOW() ELSE NULL END,
        p_user_id
      );
    ELSE
      UPDATE public.rfis
      SET
        status = CASE
          WHEN p_patch ? 'rfi_status' THEN (p_patch->>'rfi_status')::public.rfi_status
          ELSE status
        END,
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
          WHEN p_patch ? 'rfi_status' AND (p_patch->>'rfi_status')::public.rfi_status = 'submitted_externally'
            THEN COALESCE(submitted_at, NOW())
          ELSE submitted_at
        END,
        answered_at = CASE
          WHEN p_patch ? 'rfi_status' AND (p_patch->>'rfi_status')::public.rfi_status = 'answered'
            THEN COALESCE(answered_at, NOW())
          ELSE answered_at
        END
      WHERE id = v_rfi_id;
    END IF;
  END IF;

  RETURN p_issue_id;
END;
$$;
