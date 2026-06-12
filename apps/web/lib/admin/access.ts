import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class PlatformAdminRequiredError extends Error {
  constructor() {
    super("Platform admin access required");
    this.name = "PlatformAdminRequiredError";
  }
}

export async function isPlatformAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) throw new Error(error.message);
  return Boolean(data);
}

function isMissingPlatformAdminRpcError(err: unknown) {
  return (
    err instanceof Error &&
    err.message.includes("public.is_platform_admin") &&
    err.message.includes("schema cache")
  );
}

export async function getOptionalPlatformAdminFlag(supabase: SupabaseClient) {
  try {
    return await isPlatformAdmin(supabase);
  } catch (err) {
    if (isMissingPlatformAdminRpcError(err)) return false;
    throw err;
  }
}

export async function requirePlatformAdmin(supabase: SupabaseClient) {
  if (!(await isPlatformAdmin(supabase))) {
    throw new PlatformAdminRequiredError();
  }
}
