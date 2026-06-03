-- Page image storage for rendered PDF pages (Phase 2)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'page-images',
  'page-images',
  false,
  52428800,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path format: {org_id}/{project_id}/pages/{document_id}_p{n}.png

CREATE POLICY "Org members can read page images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'page-images'
  AND public.is_org_member(public.storage_org_id(name))
);

CREATE POLICY "Service can upload page images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'page-images'
  AND public.is_org_member(public.storage_org_id(name))
);

CREATE POLICY "Org admins can delete page images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'page-images'
  AND public.is_org_admin(public.storage_org_id(name))
);
