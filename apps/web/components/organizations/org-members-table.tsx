"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { MemberRole, OrganizationMember, Profile } from "@/lib/types/database";

type MemberRow = OrganizationMember & {
  profiles?: Pick<Profile, "email" | "full_name"> | null;
};

export function OrgMembersTable({
  organizationId,
  members,
  canEdit,
  assignableRolesByMemberId,
}: {
  organizationId: string;
  members: MemberRow[];
  canEdit: boolean;
  assignableRolesByMemberId: Record<string, MemberRole[]>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(memberId: string, role: MemberRole) {
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update role");
      setMessage("Member role updated. Refresh to see the latest roles.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Team</h2>
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Member</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Role</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {members.map((member) => {
              const editableRoles = assignableRolesByMemberId[member.id] ?? [];

              return (
                <tr key={member.id}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {member.profiles?.full_name ?? member.profiles?.email ?? member.user_id}
                    </p>
                    {member.profiles?.email && (
                      <p className="text-xs text-zinc-500">{member.profiles.email}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canEdit && editableRoles.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={member.role}
                          onChange={(event) => updateRole(member.id, event.target.value as MemberRole)}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {editableRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="capitalize">{member.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-zinc-500">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canEdit && (
        <p className="mt-3 text-sm text-zinc-500">Only organization owners/admins can edit roles.</p>
      )}
    </Card>
  );
}
