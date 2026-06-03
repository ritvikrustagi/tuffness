-- Phase 8: AI Risk Register metadata

ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'risk_agent';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS risk_category TEXT,
  ADD COLUMN IF NOT EXISTS risk_score INT,
  ADD COLUMN IF NOT EXISTS risk_tier TEXT,
  ADD COLUMN IF NOT EXISTS cost_impact TEXT,
  ADD COLUMN IF NOT EXISTS schedule_impact TEXT,
  ADD COLUMN IF NOT EXISTS compliance_impact TEXT,
  ADD COLUMN IF NOT EXISTS responsible_party TEXT,
  ADD COLUMN IF NOT EXISTS responsible_trade TEXT,
  ADD COLUMN IF NOT EXISTS spec_section TEXT,
  ADD COLUMN IF NOT EXISTS drawing_sheet TEXT,
  ADD COLUMN IF NOT EXISTS required_artifact TEXT,
  ADD COLUMN IF NOT EXISTS blocked_activity TEXT,
  ADD COLUMN IF NOT EXISTS risk_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS evidence_strength TEXT,
  ADD COLUMN IF NOT EXISTS human_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_risk_category_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_risk_category_check CHECK (
        risk_category IS NULL OR risk_category IN (
          'drawing_spec_conflict',
          'missing_information',
          'coordination_conflict',
          'submittal_requirement',
          'possible_spec_deviation',
          'owner_design_approval',
          'schedule_constraint',
          'cost_exposure',
          'closeout_risk',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_risk_score_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_risk_score_check CHECK (
        risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_risk_tier_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_risk_tier_check CHECK (
        risk_tier IS NULL OR risk_tier IN ('low', 'medium', 'high', 'critical')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_cost_impact_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_cost_impact_check CHECK (
        cost_impact IS NULL OR cost_impact IN ('none', 'low', 'medium', 'high', 'critical')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_schedule_impact_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_schedule_impact_check CHECK (
        schedule_impact IS NULL OR schedule_impact IN ('none', 'low', 'medium', 'high', 'critical')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_compliance_impact_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_compliance_impact_check CHECK (
        compliance_impact IS NULL OR compliance_impact IN (
          'none',
          'possible_noncompliance',
          'spec_deviation',
          'code_or_life_safety',
          'submittal_required',
          'owner_approval_required',
          'inspection_or_testing_required',
          'closeout_required'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_required_artifact_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_required_artifact_check CHECK (
        required_artifact IS NULL OR required_artifact IN (
          'none',
          'rfi',
          'submittal',
          'test_report',
          'owner_approval',
          'inspection',
          'closeout_document'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'issues_evidence_strength_check'
      AND conrelid = 'public.issues'::regclass
  ) THEN
    ALTER TABLE public.issues
      ADD CONSTRAINT issues_evidence_strength_check CHECK (
        evidence_strength IS NULL OR evidence_strength IN ('weak', 'moderate', 'strong')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_issues_risk_register
  ON public.issues(project_id, risk_tier, risk_score DESC)
  WHERE risk_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_compliance_impact
  ON public.issues(project_id, compliance_impact)
  WHERE compliance_impact IS NOT NULL AND compliance_impact <> 'none';

CREATE INDEX IF NOT EXISTS idx_issues_responsible_trade
  ON public.issues(project_id, responsible_trade)
  WHERE responsible_trade IS NOT NULL;
