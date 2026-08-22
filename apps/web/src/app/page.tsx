"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Login/register pages have been removed - there is no separate sign-in
// flow, so the home route always sends the user straight to the dashboard.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-950">
      <div className="font-mono text-sm text-ink-700">loading console...</div>
    </main>
  );
}
