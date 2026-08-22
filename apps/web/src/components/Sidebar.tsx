"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/devices", label: "Devices" },
  { href: "/dashboard/system", label: "System status" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-base-700 p-4">
      <div className="mb-8 px-2">
        <div className="font-display text-sm font-semibold tracking-tight text-ink-100">AGENT OS</div>
        <div className="text-xs text-ink-700">console</div>
      </div>
      <ul className="space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded px-3 py-2 text-sm transition-colors ${
                  active ? "bg-base-800 text-ink-100" : "text-ink-500 hover:bg-base-800/60 hover:text-ink-300"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
