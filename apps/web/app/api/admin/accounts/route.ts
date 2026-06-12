import { NextResponse } from "next/server";
import { PlatformAdminRequiredError, requirePlatformAdmin } from "@/lib/admin/access";
import { listAdminAccountSummaries } from "@/lib/admin/account-summaries";
import { isAccountStatus } from "@/lib/accounts/schema";
import { requireUser } from "@/lib/api/auth";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  try {
    await requirePlatformAdmin(supabase);
  } catch (err) {
    if (err instanceof PlatformAdminRequiredError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const result = await listAdminAccountSummaries(supabase, {
    search: url.searchParams.get("q"),
    status: rawStatus && isAccountStatus(rawStatus) ? rawStatus : "all",
    page: Number(url.searchParams.get("page") ?? 1) || 1,
    pageSize: Number(url.searchParams.get("page_size") ?? 50) || 50,
  });

  return NextResponse.json(result);
}
