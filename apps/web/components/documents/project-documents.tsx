"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { DocumentList } from "@/components/documents/document-list";
import type { Document } from "@/lib/types/database";

export function ProjectDocuments({
  projectId,
  initialDocuments,
}: {
  projectId: string;
  initialDocuments: Document[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Upload document</h2>
        <UploadDropzone
          projectId={projectId}
          onUploaded={() => router.refresh()}
        />
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Documents</h2>
        <DocumentList documents={initialDocuments} projectId={projectId} />
      </div>
    </div>
  );
}
