const supabaseFetchErrorMessage =
  "Could not reach Supabase Auth. Check NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local and make sure the project is active.";

export function getAuthErrorMessage(err: unknown) {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return supabaseFetchErrorMessage;
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }

  return "Authentication failed";
}
