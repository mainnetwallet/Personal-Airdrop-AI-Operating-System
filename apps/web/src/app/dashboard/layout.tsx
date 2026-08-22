"use client";

import { useAuth } from "@/lib/authContext";
import { Sidebar } from "@/components/Sidebar";

// No login/register pages exist, so this layout no longer gates on or
// redirects to a sign-in flow. It still shows the session's device id
// and a sign-out control when a session happens to be present (e.g. one
// created directly against the API), but never blocks rendering on it.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-base-700 px-6 py-3">
          <div className="font-mono text-xs text-ink-500">
            {session ? <>device <span className="text-ink-300">{session.deviceId.slice(0, 8)}</span></> : "no session"}
          </div>
          {session && (
            <button onClick={() => logout()} className="text-xs text-ink-500 hover:text-ink-100">
              Sign out
            </button>
          )}
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
