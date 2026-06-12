"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteRoles } from "@/lib/accounts/schema";
import type { MemberRole, OrganizationInvite } from "@/lib/types/database";

export function OrgInvites({
  organizationId,
  invites,
  canInvite,
}: {
  organizationId: string;
  invites: OrganizationInvite[];
  canInvite: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof inviteRoles)[number]>("member");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create invite");
      setEmail("");
      setRole("member");
      setMessage("Invite staged. Refresh to see pending invites.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Invites</h2>
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {canInvite && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Exclude<MemberRole, "owner">)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {inviteRoles.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={createInvite} disabled={!email.trim()}>
              Add invite
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {invites.map((invite) => (
          <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <span>{invite.email}</span>
            <span className="capitalize text-zinc-500">
              {invite.role} · {invite.status}
            </span>
          </div>
        ))}
        {invites.length === 0 && <p className="text-sm text-zinc-500">No pending invites.</p>}
      </div>
    </Card>
  );
}
