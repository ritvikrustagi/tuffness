"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DocumentType } from "@/lib/types/database";

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "spec", label: "Specification" },
  { value: "drawing", label: "Drawing" },
  { value: "submittal", label: "Submittal" },
  { value: "other", label: "Other" },
];

export function UploadDropzone({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("spec");
  const [discipline, setDiscipline] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Only PDF files are supported");
        return;
      }

      setError(null);
      setUploading(true);
      setProgress("Preparing upload...");

      try {
        const urlRes = await fetch(`/api/projects/${projectId}/documents/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            documentType,
            discipline: discipline || null,
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error || "Failed to get upload URL");

        setProgress("Uploading PDF...");

        const uploadRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to storage");

        setProgress("Saving document record...");

        const docRes = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: urlData.documentId,
            name: file.name.replace(/\.pdf$/i, ""),
            file_name: file.name,
            storage_path: urlData.storagePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            document_type: documentType,
            discipline: discipline || null,
          }),
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData.error || "Failed to save document");

        setProgress(null);
        onUploaded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setProgress(null);
      } finally {
        setUploading(false);
      }
    },
    [projectId, documentType, discipline, onUploaded]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="documentType">Document type</Label>
          <select
            id="documentType"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            disabled={uploading}
          >
            {documentTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="discipline">Discipline (optional)</Label>
          <input
            id="discipline"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
            placeholder="Architectural, MEP..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            disabled={uploading}
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition ${
          dragging
            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <Upload className="mb-3 h-8 w-8 text-zinc-400" />
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Drop a PDF here or choose a file
        </p>
        <p className="mb-4 text-xs text-zinc-500">PDF only</p>
        <label>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
          <span className="inline-flex cursor-pointer">
            <Button type="button" variant="secondary" disabled={uploading}>
              {uploading ? "Uploading..." : "Choose PDF"}
            </Button>
          </span>
        </label>
        {progress && <p className="mt-3 text-sm text-zinc-500">{progress}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
