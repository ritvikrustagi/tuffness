import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { mapMemberships } from "@/lib/api/organizations";

export async function GET() {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data: memberships, error: memberError } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .eq("user_id", user!.id);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const organizations = mapMemberships(memberships);

  return NextResponse.json({
    user: profile,
    organizations,
  });
}
