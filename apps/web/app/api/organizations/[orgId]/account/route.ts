import { NextResponse } from "next/server";
import { isCompanyType } from "@/lib/accounts/schema";
import { canManageOrganization } from "@/lib/api/organizations";
import { requireOrgMember } from "@/lib/api/auth";
import { rpcErrorResponse } from "@/lib/api/rpc-errors";

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

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
  const companyType = typeof body.company_type === "string" ? body.company_type : "other";

  if (!isCompanyType(companyType)) {
    return NextResponse.json({ error: "Invalid company type" }, { status: 400 });
  }

  const { data: account, error } = await supabase
    .rpc("update_organization_account_profile", {
      p_organization_id: orgId,
      p_company_type: companyType,
      p_website: cleanOptionalString(body.website),
      p_primary_contact_name: cleanOptionalString(body.primary_contact_name),
      p_primary_contact_email: cleanOptionalString(body.primary_contact_email),
      p_billing_contact_email: cleanOptionalString(body.billing_contact_email),
    });

  if (error) return rpcErrorResponse(error);

  return NextResponse.json({ account });
}
