import { notFound } from "next/navigation";
import { AdminAccountTable } from "@/components/admin/admin-account-table";
import { Card } from "@/components/ui/card";
import { requirePlatformAdmin, PlatformAdminRequiredError } from "@/lib/admin/access";
import { listAdminAccountSummaries } from "@/lib/admin/account-summaries";
import { isAccountStatus } from "@/lib/accounts/schema";
import { createClient } from "@/lib/supabase/server";

const pageSize = 25;

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  try {
    await requirePlatformAdmin(supabase);
  } catch (err) {
    if (err instanceof PlatformAdminRequiredError) notFound();
    throw err;
  }

  const status = params.status && isAccountStatus(params.status) ? params.status : "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const result = await listAdminAccountSummaries(supabase, {
    search: params.q ?? null,
    status,
    page,
    pageSize,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Customer accounts
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Monitor company health, usage, onboarding, and support risk.
        </p>
      </div>
      <Card>
        <AdminAccountTable
          accounts={result.accounts}
          filters={{ search: params.q ?? "", status }}
          pagination={result.pagination}
        />
      </Card>
    </div>
  );
}
