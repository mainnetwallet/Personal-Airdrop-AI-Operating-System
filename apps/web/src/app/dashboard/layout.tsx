"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base-950">
        <div className="font-mono text-sm text-ink-700">loading console...</div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-base-700 px-6 py-3">
          <div className="font-mono text-xs text-ink-500">
            device <span className="text-ink-300">{session.deviceId.slice(0, 8)}</span>
          </div>
          <button
            onClick={() => logout().then(() => router.push("/login"))}
            className="text-xs text-ink-500 hover:text-ink-100"
          >
            Sign out
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
