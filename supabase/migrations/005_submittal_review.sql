-- Phase 5: Submittal review enhancements

ALTER TABLE public.submittals
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS review_result JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS submittal_id UUID REFERENCES public.submittals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_submittal ON public.issues(submittal_id);
