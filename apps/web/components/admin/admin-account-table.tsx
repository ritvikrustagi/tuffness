import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AccountStatusBadge } from "@/components/admin/account-status-badge";
import type {
  AdminAccountListResult,
  AdminAccountSummary,
} from "@/lib/admin/account-summaries";
import type { AccountStatus } from "@/lib/types/database";

type AdminAccountTableProps = {
  accounts: AdminAccountSummary[];
  filters: {
    search: string;
    status: AccountStatus | "all";
  };
  pagination: AdminAccountListResult["pagination"];
};

function pageHref(page: number, filters: AdminAccountTableProps["filters"]) {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set("q", search);
  if (filters.status !== "all") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/accounts?${query}` : "/admin/accounts";
}

export function AdminAccountTable({ accounts, filters, pagination }: AdminAccountTableProps) {
  return (
    <div className="space-y-4">
      <form action="/admin/accounts" className="flex flex-col gap-3 sm:flex-row">
        <Input
          name="q"
          defaultValue={filters.search}
          placeholder="Search company, slug, or contact"
        />
        <select
          name="status"
          defaultValue={filters.status}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="all">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Company</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Usage</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Health</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {accounts.map((account) => (
              <tr key={account.organization.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/accounts/${account.organization.id}`}
                    className="font-medium text-orange-700 hover:text-orange-800 dark:text-orange-400"
                  >
                    {account.organization.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{account.organization.slug}</p>
                </td>
                <td className="px-4 py-3">
                  {account.account ? (
                    <AccountStatusBadge status={account.account.status} />
                  ) : (
                    <span className="text-zinc-500">Missing account</span>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{account.account?.plan ?? "starter"}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {account.counts.projectCount} projects · {account.counts.documentsProcessed} docs ·{" "}
                  {account.counts.aiRunCount} AI runs
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize">{account.health.healthLevel}</span>
                  <p className="text-xs text-zinc-500">{account.health.primaryConcern}</p>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {account.health.activityLabel}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={6}>
                  No accounts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
        <span>
          Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} accounts
        </span>
        <div className="flex items-center gap-2">
          {pagination.page > 1 ? (
            <Link
              href={pageHref(pagination.page - 1, filters)}
              className="rounded-lg border border-zinc-300 px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-400 dark:border-zinc-800">
              Previous
            </span>
          )}
          {pagination.page < pagination.totalPages ? (
            <Link
              href={pageHref(pagination.page + 1, filters)}
              className="rounded-lg border border-zinc-300 px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 px-3 py-2 text-zinc-400 dark:border-zinc-800">
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
