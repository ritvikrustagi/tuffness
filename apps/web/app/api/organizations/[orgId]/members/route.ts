import { NextResponse } from "next/server";
import { canManageOrganization, isMemberRole } from "@/lib/api/organizations";
import { requireOrgMember } from "@/lib/api/auth";
import { rpcErrorResponse } from "@/lib/api/rpc-errors";

export async function PATCH(
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
  const memberId = typeof body.member_id === "string" ? body.member_id : null;
  const nextRole = body.role;

  if (!memberId || !isMemberRole(nextRole)) {
    return NextResponse.json({ error: "member_id and valid role are required" }, { status: 400 });
  }

  const { data: member, error } = await supabase
    .rpc("update_organization_member_role", {
      p_organization_id: orgId,
      p_member_id: memberId,
      p_next_role: nextRole,
    });

  if (error) return rpcErrorResponse(error);

  return NextResponse.json({ member });
}
