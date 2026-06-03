import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const { supabase, errorResponse } = await requireOrgMember(orgId);
  if (errorResponse) return errorResponse;

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ organization });
}
