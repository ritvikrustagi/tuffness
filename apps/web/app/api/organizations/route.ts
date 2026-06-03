import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { mapMemberships } from "@/lib/api/organizations";
import { slugify } from "@/lib/utils";

export async function GET() {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const organizations = mapMemberships(data);

  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = slugify(name);
  if (!slug) slug = "organization";

  const { data: existing } = await supabase
    .from("organizations")
    .select("slug")
    .like("slug", `${slug}%`);

  if (existing && existing.length > 0) {
    slug = `${slug}-${existing.length + 1}`;
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ organization }, { status: 201 });
}
