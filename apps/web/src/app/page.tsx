"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";

export default function Home() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/dashboard" : "/login");
  }, [loading, session, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-950">
      <div className="font-mono text-sm text-ink-700">loading console...</div>
    </main>
  );
}
