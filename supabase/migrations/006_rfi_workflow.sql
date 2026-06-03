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
