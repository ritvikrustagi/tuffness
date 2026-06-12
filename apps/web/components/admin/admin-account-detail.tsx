"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";
import { accountPlans, accountStatuses } from "@/lib/accounts/schema";
import type { AdminAccountDetail } from "@/lib/admin/account-detail";
import type { AccountPlan, AccountStatus } from "@/lib/types/database";

export function AdminAccountDetail({ detail }: { detail: AdminAccountDetail }) {
  const [status, setStatus] = useState<AccountStatus>(detail.account?.status ?? "trial");
  const [plan, setPlan] = useState<AccountPlan>(detail.account?.plan ?? "starter");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveAccount() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/accounts/${detail.organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          plan,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update account");
      setNote("");
      setMessage("Account updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Projects", detail.counts.projectCount],
          ["Processed docs", detail.counts.documentsProcessed],
          ["AI runs", detail.counts.aiRunCount],
          ["Open high risk", detail.counts.openHighRiskCount],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {value}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Account controls
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{detail.health.primaryConcern}</p>
          </div>
          <AccountStatusBadge status={status} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AccountStatus)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {accountStatuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Plan</Label>
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value as AccountPlan)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {accountPlans.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Internal note</Label>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add customer success, support, or sales context"
            />
          </div>
        </div>
        <Button type="button" className="mt-4" onClick={saveAccount} disabled={saving}>
          {saving ? "Saving..." : "Save account"}
        </Button>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Projects</h3>
          <div className="mt-4 space-y-3">
            {detail.recentProjects.slice(0, 8).map((project) => (
              <div key={project.id} className="border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{project.name}</p>
                <p className="text-zinc-500">{project.project_number ?? "No project number"}</p>
              </div>
            ))}
            {detail.recentProjects.length === 0 && <p className="text-sm text-zinc-500">No projects yet.</p>}
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Recent admin notes</h3>
          <div className="mt-4 space-y-3">
            {detail.notes.slice(0, 8).map((item) => (
              <div key={item.id} className="border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800">
                <p className="text-zinc-800 dark:text-zinc-200">{item.note}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
            {detail.notes.length === 0 && <p className="text-sm text-zinc-500">No notes yet.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Audit timeline</h3>
        <div className="mt-4 space-y-3">
          {detail.auditEvents.slice(0, 12).map((event) => (
            <div key={event.id} className="border-b border-zinc-100 pb-2 text-sm last:border-0 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{event.event_type}</p>
              <p className="text-xs text-zinc-500">
                {event.actor_kind} · {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {detail.auditEvents.length === 0 && <p className="text-sm text-zinc-500">No audit events yet.</p>}
        </div>
      </Card>
    </div>
  );
}
