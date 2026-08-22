"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { currentWebDevice } from "@/lib/deviceFingerprint";

export default function LoginPage() {
  const { login, error, clearError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      await login(email, password, currentWebDevice());
      router.push("/dashboard");
    } catch {
      // error already surfaced via auth context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-lg font-semibold tracking-tight text-ink-100">AGENT OS</div>
          <p className="mt-1 text-sm text-ink-500">Sign in to your console</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded border border-base-700 bg-base-900 p-6">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs uppercase tracking-wide text-ink-500">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink-100 outline-none focus-visible:border-signal-active"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs uppercase tracking-wide text-ink-500">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-base-600 bg-base-800 px-3 py-2 text-sm text-ink-100 outline-none focus-visible:border-signal-active"
              placeholder="••••••••••••"
            />
          </div>

          {error && (
            <div className="rounded border border-signal-blocked/40 bg-signal-blocked/10 px-3 py-2 text-sm text-signal-blocked">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-signal-active px-3 py-2 text-sm font-medium text-base-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          New here?{" "}
          <Link href="/register" className="text-signal-active hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
