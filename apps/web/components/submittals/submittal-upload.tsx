"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { SUBMITTAL_CATEGORIES, type SubmittalCategory } from "@/lib/agents/submittal/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubmittalUpload({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (submittalId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<SubmittalCategory>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Only PDF files are supported");
        return;
      }

      const submittalTitle = title.trim() || file.name.replace(/\.pdf$/i, "");
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
            documentType: "submittal",
            discipline: category,
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error || "Failed to get upload URL");

        setProgress("Uploading submittal PDF...");
        const uploadRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Failed to upload file to storage");

        setProgress("Creating document record...");
        const docRes = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: urlData.documentId,
            name: submittalTitle,
            file_name: file.name,
            storage_path: urlData.storagePath,
            mime_type: file.type,
            file_size_bytes: file.size,
            document_type: "submittal",
            discipline: category,
          }),
        });
        const docData = await docRes.json();
        if (!docRes.ok) throw new Error(docData.error || "Failed to save document");

        setProgress("Creating submittal record...");
        const subRes = await fetch(`/api/projects/${projectId}/submittals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_id: docData.document.id,
            title: submittalTitle,
            category,
          }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(subData.error || "Failed to create submittal");

        setProgress(null);
        setTitle("");
        onUploaded(subData.submittal.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setProgress(null);
      } finally {
        setUploading(false);
      }
    },
    [projectId, title, category, onUploaded]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="submittalTitle">Submittal title</Label>
          <Input
            id="submittalTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Door Hardware Submittal"
            disabled={uploading}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as SubmittalCategory)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            disabled={uploading}
          >
            {SUBMITTAL_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${
          uploading ? "opacity-60" : "hover:border-orange-300"
        } border-zinc-300 dark:border-zinc-700`}
      >
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
        <Upload className="mb-2 h-7 w-7 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Drop submittal PDF or click to upload
        </p>
        {progress && <p className="mt-2 text-xs text-zinc-500">{progress}</p>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
