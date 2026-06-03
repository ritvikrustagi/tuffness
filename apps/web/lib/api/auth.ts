import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, supabase, errorResponse: null };
}

export async function requireOrgMember(orgId: string) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return { user: null, supabase, errorResponse, membership: null };

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error || !membership) {
    return {
      user,
      supabase,
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      membership: null,
    };
  }

  return { user, supabase, errorResponse: null, membership };
}

export async function requireProjectAccess(projectId: string) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return { user: null, supabase, errorResponse, project: null };

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    return {
      user,
      supabase,
      errorResponse: NextResponse.json({ error: "Project not found" }, { status: 404 }),
      project: null,
    };
  }

  const memberCheck = await requireOrgMember(project.organization_id);
  if (memberCheck.errorResponse) {
    return { user, supabase, errorResponse: memberCheck.errorResponse, project: null };
  }

  return { user, supabase, errorResponse: null, project };
}
