import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAccountDetail } from "@/components/admin/admin-account-detail";
import { requirePlatformAdmin, PlatformAdminRequiredError } from "@/lib/admin/access";
import { getAdminAccountDetail } from "@/lib/admin/account-detail";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const supabase = await createClient();

  try {
    await requirePlatformAdmin(supabase);
  } catch (err) {
    if (err instanceof PlatformAdminRequiredError) notFound();
    throw err;
  }

  const detail = await getAdminAccountDetail(supabase, organizationId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/accounts" className="text-sm font-medium text-orange-700 hover:text-orange-800">
        Back to accounts
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {detail.organization.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {detail.organization.slug} · {detail.account?.plan ?? "starter"}
        </p>
      </div>
      <AdminAccountDetail detail={detail} />
    </div>
  );
}
