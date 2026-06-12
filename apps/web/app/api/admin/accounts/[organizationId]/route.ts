import { NextResponse } from "next/server";
import { PlatformAdminRequiredError, requirePlatformAdmin } from "@/lib/admin/access";
import { isAccountPlan, isAccountStatus } from "@/lib/accounts/schema";
import { requireUser } from "@/lib/api/auth";
import { rpcErrorResponse } from "@/lib/api/rpc-errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;
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

  const body = await request.json();
  const status = typeof body.status === "string" ? body.status : null;
  const plan = typeof body.plan === "string" ? body.plan : null;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (status && !isAccountStatus(status)) {
    return NextResponse.json({ error: "Invalid account status" }, { status: 400 });
  }

  if (plan && !isAccountPlan(plan)) {
    return NextResponse.json({ error: "Invalid account plan" }, { status: 400 });
  }

  const { data: account, error } = await supabase.rpc("platform_update_organization_account", {
    p_organization_id: organizationId,
    p_status: status,
    p_plan: plan,
    p_note: note || null,
  });

  if (error) return rpcErrorResponse(error);

  return NextResponse.json({ account });
}
