-- Storage buckets and policies for Phase 1 document upload

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  104857600,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path format: {org_id}/{project_id}/documents/{document_id}.pdf

CREATE OR REPLACE FUNCTION public.storage_org_id(object_name TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN split_part(object_name, '/', 1)::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE POLICY "Org members can read documents bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_org_member(public.storage_org_id(name))
);

CREATE POLICY "Org members can upload documents bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_org_member(public.storage_org_id(name))
);

CREATE POLICY "Org admins can delete documents bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_org_admin(public.storage_org_id(name))
);
