"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { companyTypes } from "@/lib/accounts/schema";
import type { CompanyType, Organization, OrganizationAccount } from "@/lib/types/database";

export function OrgSettingsForm({
  organization,
  account,
  canEdit,
}: {
  organization: Organization;
  account: OrganizationAccount | null;
  canEdit: boolean;
}) {
  const [website, setWebsite] = useState(account?.website ?? "");
  const [companyType, setCompanyType] = useState<CompanyType>(
    account?.company_type ?? "general_contractor"
  );
  const [primaryContactName, setPrimaryContactName] = useState(
    account?.primary_contact_name ?? ""
  );
  const [primaryContactEmail, setPrimaryContactEmail] = useState(
    account?.primary_contact_email ?? ""
  );
  const [billingContactEmail, setBillingContactEmail] = useState(
    account?.billing_contact_email ?? ""
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/organizations/${organization.id}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website,
          company_type: companyType,
          primary_contact_name: primaryContactName,
          primary_contact_email: primaryContactEmail,
          billing_contact_email: billingContactEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save account settings");
      setMessage("Organization settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Account profile
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Company metadata used for onboarding, billing, and support.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700">
          {account?.status ?? "trial"} · {account?.plan ?? "starter"}
        </span>
      </div>

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Website</Label>
          <Input value={website} onChange={(event) => setWebsite(event.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <Label>Company type</Label>
          <select
            value={companyType}
            onChange={(event) => setCompanyType(event.target.value as CompanyType)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {companyTypes.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Primary contact name</Label>
          <Input
            value={primaryContactName}
            onChange={(event) => setPrimaryContactName(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Primary contact email</Label>
          <Input
            type="email"
            value={primaryContactEmail}
            onChange={(event) => setPrimaryContactEmail(event.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Billing contact email</Label>
          <Input
            type="email"
            value={billingContactEmail}
            onChange={(event) => setBillingContactEmail(event.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      {canEdit && (
        <Button type="button" className="mt-5" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      )}
    </Card>
  );
}
