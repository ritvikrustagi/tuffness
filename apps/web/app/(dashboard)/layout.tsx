import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { getOptionalPlatformAdminFlag } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const showAdmin = await getOptionalPlatformAdminFlag(supabase);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <AppHeader email={profile?.email ?? user.email ?? ""} showAdmin={showAdmin} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
