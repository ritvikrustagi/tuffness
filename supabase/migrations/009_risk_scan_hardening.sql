-- Phase 9: Risk scan hardening

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_one_running_risk_agent
  ON public.agent_runs(project_id, agent_type)
  WHERE status = 'running' AND agent_type = 'risk_agent';

CREATE OR REPLACE FUNCTION public.create_risk_issue_with_optional_rfi(
  p_project_id UUID,
  p_organization_id UUID,
  p_agent_run_id UUID,
  p_user_id UUID,
  p_issue_type public.issue_type,
  p_severity public.issue_severity,
  p_summary TEXT,
  p_description TEXT,
  p_evidence JSONB,
  p_draft_rfi TEXT,
  p_confidence NUMERIC,
  p_trade TEXT,
  p_recommended_action TEXT,
  p_risk_category TEXT,
  p_risk_score INT,
  p_risk_tier TEXT,
  p_cost_impact TEXT,
  p_schedule_impact TEXT,
  p_compliance_impact TEXT,
  p_responsible_party TEXT,
  p_responsible_trade TEXT,
  p_spec_section TEXT,
  p_drawing_sheet TEXT,
  p_required_artifact TEXT,
  p_blocked_activity TEXT,
  p_risk_reasoning TEXT,
  p_evidence_strength TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue_id UUID;
  v_draft_rfi TEXT;
  v_issue_status public.issue_status;
BEGIN
  v_draft_rfi := NULLIF(BTRIM(p_draft_rfi), '');

  IF p_required_artifact = 'rfi' AND v_draft_rfi IS NULL THEN
    RAISE EXCEPTION 'draft_rfi is required when required_artifact is rfi';
  END IF;

  IF p_required_artifact <> 'rfi' AND v_draft_rfi IS NOT NULL THEN
    RAISE EXCEPTION 'required_artifact must be rfi when draft_rfi is present';
  END IF;

  v_issue_status := CASE
    WHEN p_required_artifact = 'rfi' THEN 'draft_rfi'::public.issue_status
    ELSE 'open'::public.issue_status
  END;

  INSERT INTO public.issues (
    project_id,
    organization_id,
    agent_run_id,
    issue_type,
    severity,
    status,
    summary,
    description,
    evidence,
    draft_rfi,
    confidence,
    trade,
    recommended_action,
    risk_category,
    risk_score,
    risk_tier,
    cost_impact,
    schedule_impact,
    compliance_impact,
    responsible_party,
    responsible_trade,
    spec_section,
    drawing_sheet,
    required_artifact,
    blocked_activity,
    risk_reasoning,
    evidence_strength,
    created_by
  )
  VALUES (
    p_project_id,
    p_organization_id,
    p_agent_run_id,
    p_issue_type,
    p_severity,
    v_issue_status,
    p_summary,
    p_description,
    COALESCE(p_evidence, '[]'::JSONB),
    v_draft_rfi,
    p_confidence,
    p_trade,
    p_recommended_action,
    p_risk_category,
    p_risk_score,
    p_risk_tier,
    p_cost_impact,
    p_schedule_impact,
    p_compliance_impact,
    p_responsible_party,
    p_responsible_trade,
    p_spec_section,
    p_drawing_sheet,
    p_required_artifact,
    p_blocked_activity,
    p_risk_reasoning,
    p_evidence_strength,
    p_user_id
  )
  RETURNING id INTO v_issue_id;

  IF p_required_artifact = 'rfi' THEN
    INSERT INTO public.rfis (
      project_id,
      organization_id,
      issue_id,
      subject,
      question,
      status,
      created_by
    )
    VALUES (
      p_project_id,
      p_organization_id,
      v_issue_id,
      LEFT(p_summary, 200),
      v_draft_rfi,
      'draft'::public.rfi_status,
      p_user_id
    );
  END IF;

  RETURN v_issue_id;
END;
$$;
