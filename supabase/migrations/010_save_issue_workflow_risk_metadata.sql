-- Phase 10: Keep risk metadata updates atomic with issue workflow updates.

CREATE OR REPLACE FUNCTION public.save_issue_with_risk_metadata(
  p_project_id UUID,
  p_issue_id UUID,
  p_user_id UUID,
  p_workflow_patch JSONB,
  p_risk_patch JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.save_issue_workflow(
    p_project_id,
    p_issue_id,
    p_user_id,
    p_workflow_patch
  );

  IF p_risk_patch ?| ARRAY[
    'risk_category',
    'risk_score',
    'risk_tier',
    'cost_impact',
    'schedule_impact',
    'compliance_impact',
    'responsible_party',
    'responsible_trade',
    'spec_section',
    'drawing_sheet',
    'required_artifact',
    'blocked_activity',
    'risk_reasoning',
    'evidence_strength'
  ] THEN
    UPDATE public.issues
    SET
      risk_category = CASE
        WHEN p_risk_patch ? 'risk_category' THEN NULLIF(p_risk_patch->>'risk_category', '')
        ELSE risk_category
      END,
      risk_score = CASE
        WHEN p_risk_patch ? 'risk_score' THEN NULLIF(p_risk_patch->>'risk_score', '')::INT
        ELSE risk_score
      END,
      risk_tier = CASE
        WHEN p_risk_patch ? 'risk_tier' THEN NULLIF(p_risk_patch->>'risk_tier', '')
        ELSE risk_tier
      END,
      cost_impact = CASE
        WHEN p_risk_patch ? 'cost_impact' THEN NULLIF(p_risk_patch->>'cost_impact', '')
        ELSE cost_impact
      END,
      schedule_impact = CASE
        WHEN p_risk_patch ? 'schedule_impact' THEN NULLIF(p_risk_patch->>'schedule_impact', '')
        ELSE schedule_impact
      END,
      compliance_impact = CASE
        WHEN p_risk_patch ? 'compliance_impact' THEN NULLIF(p_risk_patch->>'compliance_impact', '')
        ELSE compliance_impact
      END,
      responsible_party = CASE
        WHEN p_risk_patch ? 'responsible_party' THEN NULLIF(p_risk_patch->>'responsible_party', '')
        ELSE responsible_party
      END,
      responsible_trade = CASE
        WHEN p_risk_patch ? 'responsible_trade' THEN NULLIF(p_risk_patch->>'responsible_trade', '')
        ELSE responsible_trade
      END,
      spec_section = CASE
        WHEN p_risk_patch ? 'spec_section' THEN NULLIF(p_risk_patch->>'spec_section', '')
        ELSE spec_section
      END,
      drawing_sheet = CASE
        WHEN p_risk_patch ? 'drawing_sheet' THEN NULLIF(p_risk_patch->>'drawing_sheet', '')
        ELSE drawing_sheet
      END,
      required_artifact = CASE
        WHEN p_risk_patch ? 'required_artifact' THEN NULLIF(p_risk_patch->>'required_artifact', '')
        ELSE required_artifact
      END,
      blocked_activity = CASE
        WHEN p_risk_patch ? 'blocked_activity' THEN NULLIF(p_risk_patch->>'blocked_activity', '')
        ELSE blocked_activity
      END,
      risk_reasoning = CASE
        WHEN p_risk_patch ? 'risk_reasoning' THEN NULLIF(p_risk_patch->>'risk_reasoning', '')
        ELSE risk_reasoning
      END,
      evidence_strength = CASE
        WHEN p_risk_patch ? 'evidence_strength' THEN NULLIF(p_risk_patch->>'evidence_strength', '')
        ELSE evidence_strength
      END,
      human_reviewed_at = NOW(),
      human_reviewed_by = p_user_id
    WHERE id = p_issue_id
      AND project_id = p_project_id;
  END IF;

  RETURN p_issue_id;
END;
$$;
