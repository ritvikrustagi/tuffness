-- Phase 7: Integration connector scaffold

CREATE TABLE IF NOT EXISTS public.external_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  account_label TEXT,
  external_account_id TEXT,
  token_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT external_connections_provider_check CHECK (
    provider IN (
      'manual',
      'email',
      'procore',
      'autodesk_build',
      'sharepoint_onedrive',
      'bluebeam',
      'csv'
    )
  ),
  CONSTRAINT external_connections_status_check CHECK (
    status IN ('connected', 'disconnected', 'error')
  )
);

CREATE TRIGGER external_connections_updated_at
  BEFORE UPDATE ON public.external_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_external_connections_org
  ON public.external_connections(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_connections_external_account
  ON public.external_connections(organization_id, provider, COALESCE(external_account_id, 'manual'))
  WHERE status <> 'disconnected';

CREATE TABLE IF NOT EXISTS public.external_project_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES public.external_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_project_id TEXT NOT NULL,
  external_project_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT external_project_mappings_provider_check CHECK (
    provider IN (
      'manual',
      'email',
      'procore',
      'autodesk_build',
      'sharepoint_onedrive',
      'bluebeam',
      'csv'
    )
  )
);

CREATE TRIGGER external_project_mappings_updated_at
  BEFORE UPDATE ON public.external_project_mappings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_external_project_mappings_project
  ON public.external_project_mappings(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_project_mappings_external_project
  ON public.external_project_mappings(organization_id, provider, external_project_id);

CREATE TABLE IF NOT EXISTS public.external_record_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES public.external_connections(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  internal_table TEXT NOT NULL,
  internal_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  external_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT external_record_links_provider_check CHECK (
    provider IN (
      'manual',
      'email',
      'procore',
      'autodesk_build',
      'sharepoint_onedrive',
      'bluebeam',
      'csv'
    )
  ),
  CONSTRAINT external_record_links_internal_table_check CHECK (
    internal_table IN ('documents', 'issues', 'rfis', 'submittals')
  )
);

CREATE TRIGGER external_record_links_updated_at
  BEFORE UPDATE ON public.external_record_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_external_record_links_project
  ON public.external_record_links(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_record_links_internal
  ON public.external_record_links(provider, internal_table, internal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_record_links_external
  ON public.external_record_links(connection_id, internal_table, external_id)
  WHERE connection_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES public.external_connections(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  input_params JSONB NOT NULL DEFAULT '{}',
  result_summary JSONB NOT NULL DEFAULT '{}',
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integration_sync_runs_provider_check CHECK (
    provider IN (
      'manual',
      'email',
      'procore',
      'autodesk_build',
      'sharepoint_onedrive',
      'bluebeam',
      'csv'
    )
  ),
  CONSTRAINT integration_sync_runs_operation_check CHECK (
    operation IN (
      'connect_account',
      'list_projects',
      'map_project',
      'import_documents',
      'import_rfis',
      'export_rfi',
      'sync_rfi_status',
      'disconnect_account'
    )
  ),
  CONSTRAINT integration_sync_runs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_org
  ON public.integration_sync_runs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_project
  ON public.integration_sync_runs(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_sync_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_run_id UUID NOT NULL REFERENCES public.integration_sync_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  internal_table TEXT,
  internal_id UUID,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT integration_sync_events_provider_check CHECK (
    provider IN (
      'manual',
      'email',
      'procore',
      'autodesk_build',
      'sharepoint_onedrive',
      'bluebeam',
      'csv'
    )
  ),
  CONSTRAINT integration_sync_events_internal_table_check CHECK (
    internal_table IS NULL
    OR internal_table IN ('documents', 'issues', 'rfis', 'submittals')
  ),
  CONSTRAINT integration_sync_events_status_check CHECK (
    status IN ('completed', 'failed', 'conflict')
  )
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_events_run
  ON public.integration_sync_events(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_events_project
  ON public.integration_sync_events(project_id, created_at DESC);

ALTER TABLE public.external_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_project_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view external connections"
  ON public.external_connections FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage external connections"
  ON public.external_connections FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Members can view external project mappings"
  ON public.external_project_mappings FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can manage external project mappings"
  ON public.external_project_mappings FOR ALL
  USING (public.is_org_member_or_higher(organization_id, 'member'))
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can view external record links"
  ON public.external_record_links FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can manage external record links"
  ON public.external_record_links FOR ALL
  USING (public.is_org_member_or_higher(organization_id, 'member'))
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can view integration sync runs"
  ON public.integration_sync_runs FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create integration sync runs"
  ON public.integration_sync_runs FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can view integration sync events"
  ON public.integration_sync_events FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create integration sync events"
  ON public.integration_sync_events FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));
