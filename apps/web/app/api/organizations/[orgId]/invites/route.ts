import { NextResponse } from "next/server";
import { isInviteRole } from "@/lib/accounts/schema";
import { canManageOrganization } from "@/lib/api/organizations";
import { requireOrgMember } from "@/lib/api/auth";
import { rpcErrorResponse } from "@/lib/api/rpc-errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const { supabase, errorResponse, membership } = await requireOrgMember(orgId);
  if (errorResponse) return errorResponse;

  if (!membership || !canManageOrganization(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "member";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (!isInviteRole(role)) {
    return NextResponse.json({ error: "Invalid invite role" }, { status: 400 });
  }

  const { data: invite, error } = await supabase
    .rpc("create_organization_invite", {
      p_organization_id: orgId,
      p_email: email,
      p_role: role,
    });

  if (error) return rpcErrorResponse(error);

  return NextResponse.json({ invite });
}
