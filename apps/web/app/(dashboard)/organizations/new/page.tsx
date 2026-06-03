import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CreateOrgForm } from "@/components/organizations/create-org-form";

export default function NewOrganizationPage() {
  return (
    <div className="max-w-lg">
      <Link href="/" className="text-sm text-orange-600 hover:underline">
        ← Back to organizations
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New organization
      </h1>
      <Card className="mt-6">
        <CreateOrgForm />
      </Card>
    </div>
  );
}
