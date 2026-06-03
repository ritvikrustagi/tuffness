"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const tabs = [
    { href: base, label: "Documents", exact: true },
    { href: `${base}/chat`, label: "Chat", exact: false },
    { href: `${base}/issues`, label: "RFIs", exact: false },
    { href: `${base}/submittals`, label: "Submittals", exact: false },
  ];

  return (
    <div className="mt-6 border-b border-zinc-200 dark:border-zinc-800">
      <nav className="-mb-px flex gap-6">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition",
                active
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <p className="sr-only">Project: {projectName}</p>
    </div>
  );
}
