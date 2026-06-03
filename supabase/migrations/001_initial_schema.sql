-- AI Project Engineer — Initial Schema
-- Requires: Supabase Postgres with pgvector extension

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TYPE project_status AS ENUM ('active', 'archived');

CREATE TYPE document_type AS ENUM ('spec', 'drawing', 'submittal', 'other');

CREATE TYPE document_status AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TYPE chunk_content_type AS ENUM ('text', 'table', 'note', 'title_block');

CREATE TYPE issue_type AS ENUM (
  'drawing_spec_conflict',
  'missing_info',
  'code_conflict',
  'coordination',
  'other'
);

CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE issue_status AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

CREATE TYPE rfi_status AS ENUM ('draft', 'submitted', 'answered', 'closed');

CREATE TYPE submittal_review_status AS ENUM ('pending', 'pass', 'warning', 'fail');

CREATE TYPE agent_type AS ENUM ('rfi_scan', 'submittal_review', 'document_process');

CREATE TYPE agent_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_member_or_higher(p_org_id UUID, p_min_role member_role)
RETURNS BOOLEAN AS $$
DECLARE
  v_role member_role;
  v_role_rank INT;
  v_min_rank INT;
BEGIN
  SELECT role INTO v_role
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND user_id = auth.uid();

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role_rank := CASE v_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
  END;

  v_min_rank := CASE p_min_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
  END;

  RETURN v_role_rank >= v_min_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- Organization members
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_number TEXT,
  address TEXT,
  status project_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_projects_org ON public.projects(organization_id);
CREATE INDEX idx_projects_status ON public.projects(organization_id, status);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT,
  document_type document_type NOT NULL DEFAULT 'other',
  discipline TEXT,
  status document_status NOT NULL DEFAULT 'pending',
  page_count INT,
  error_message TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_documents_project ON public.documents(project_id);
CREATE INDEX idx_documents_org ON public.documents(organization_id);
CREATE INDEX idx_documents_status ON public.documents(project_id, status);

-- Document pages
CREATE TABLE public.document_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  sheet_number TEXT,
  sheet_title TEXT,
  text_content TEXT,
  image_storage_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, page_number),
  CONSTRAINT document_pages_page_number_positive CHECK (page_number > 0)
);

CREATE INDEX idx_document_pages_document ON public.document_pages(document_id);

-- Chunks (with vector embeddings)
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_page_id UUID REFERENCES public.document_pages(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  content_type chunk_content_type NOT NULL DEFAULT 'text',
  token_count INT,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON public.chunks(document_id);
CREATE INDEX idx_chunks_project ON public.chunks(project_id);
CREATE INDEX idx_chunks_org ON public.chunks(organization_id);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON public.chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Agent runs (created before issues/submittals that reference it)
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_type agent_type NOT NULL,
  status agent_run_status NOT NULL DEFAULT 'pending',
  input_params JSONB NOT NULL DEFAULT '{}',
  output_summary JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_project ON public.agent_runs(project_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(project_id, status);

-- Issues
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  issue_type issue_type NOT NULL,
  severity issue_severity NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  summary TEXT NOT NULL,
  description TEXT,
  evidence JSONB NOT NULL DEFAULT '[]',
  draft_rfi TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_issues_project ON public.issues(project_id);
CREATE INDEX idx_issues_status ON public.issues(project_id, status);
CREATE INDEX idx_issues_severity ON public.issues(project_id, severity);
CREATE INDEX idx_issues_agent_run ON public.issues(agent_run_id);

-- RFIs
CREATE TABLE public.rfis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
  rfi_number TEXT,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  status rfi_status NOT NULL DEFAULT 'draft',
  response TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER rfis_updated_at
  BEFORE UPDATE ON public.rfis
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_rfis_project ON public.rfis(project_id);
CREATE INDEX idx_rfis_status ON public.rfis(project_id, status);
CREATE INDEX idx_rfis_issue ON public.rfis(issue_id);

-- Submittals
CREATE TABLE public.submittals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  submittal_number TEXT,
  spec_section TEXT,
  title TEXT NOT NULL,
  review_status submittal_review_status NOT NULL DEFAULT 'pending',
  review_summary TEXT,
  review_findings JSONB NOT NULL DEFAULT '[]',
  reviewed_at TIMESTAMPTZ,
  agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER submittals_updated_at
  BEFORE UPDATE ON public.submittals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_submittals_project ON public.submittals(project_id);
CREATE INDEX idx_submittals_review_status ON public.submittals(project_id, review_status);
CREATE INDEX idx_submittals_document ON public.submittals(document_id);

-- =============================================================================
-- VECTOR SEARCH FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding VECTOR(1536),
  match_project_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_page_id UUID,
  content TEXT,
  content_type chunk_content_type,
  metadata JSONB,
  similarity FLOAT,
  page_number INT,
  sheet_number TEXT,
  sheet_title TEXT,
  document_name TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.document_page_id,
    c.content,
    c.content_type,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity,
    dp.page_number,
    dp.sheet_number,
    dp.sheet_title,
    d.name AS document_name
  FROM public.chunks c
  JOIN public.documents d ON d.id = c.document_id
  LEFT JOIN public.document_pages dp ON dp.id = c.document_page_id
  WHERE c.project_id = match_project_id
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    AND (
      filter_document_ids IS NULL
      OR c.document_id = ANY(filter_document_ids)
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view org co-member profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update organizations"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id));

CREATE POLICY "Owners can delete organizations"
  ON public.organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Organization members
CREATE POLICY "Members can view org membership"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (public.is_org_admin(organization_id));

CREATE POLICY "Admins can remove members"
  ON public.organization_members FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Auto-add creator as owner when org is created
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Projects
CREATE POLICY "Members can view projects"
  ON public.projects FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can update projects"
  ON public.projects FOR UPDATE
  USING (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Documents
CREATE POLICY "Members can view documents"
  ON public.documents FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can upload documents"
  ON public.documents FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can update documents"
  ON public.documents FOR UPDATE
  USING (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Admins can delete documents"
  ON public.documents FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Document pages (read by members; write by service role via bypass)
CREATE POLICY "Members can view document pages"
  ON public.document_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_pages.document_id
        AND public.is_org_member(d.organization_id)
    )
  );

-- Chunks (read by members; write by service role via bypass)
CREATE POLICY "Members can view chunks"
  ON public.chunks FOR SELECT
  USING (public.is_org_member(organization_id));

-- Issues
CREATE POLICY "Members can view issues"
  ON public.issues FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create issues"
  ON public.issues FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can update issues"
  ON public.issues FOR UPDATE
  USING (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Admins can delete issues"
  ON public.issues FOR DELETE
  USING (public.is_org_admin(organization_id));

-- RFIs
CREATE POLICY "Members can view rfis"
  ON public.rfis FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create rfis"
  ON public.rfis FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can update rfis"
  ON public.rfis FOR UPDATE
  USING (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Admins can delete rfis"
  ON public.rfis FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Submittals
CREATE POLICY "Members can view submittals"
  ON public.submittals FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can create submittals"
  ON public.submittals FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Members can update submittals"
  ON public.submittals FOR UPDATE
  USING (public.is_org_member_or_higher(organization_id, 'member'));

CREATE POLICY "Admins can delete submittals"
  ON public.submittals FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Agent runs
CREATE POLICY "Members can view agent runs"
  ON public.agent_runs FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can trigger agent runs"
  ON public.agent_runs FOR INSERT
  WITH CHECK (public.is_org_member_or_higher(organization_id, 'member'));

-- =============================================================================
-- STORAGE BUCKETS (run via Supabase dashboard or supabase CLI)
-- =============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('page-images', 'page-images', false);
