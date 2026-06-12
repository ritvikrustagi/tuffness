import type { AccountStatus } from "@/lib/types/database";

const statusClasses: Record<AccountStatus, string> = {
  trial: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  churned: "bg-zinc-100 text-zinc-700",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClasses[status]}`}>
      {status}
    </span>
  );
}
