"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] px-4">
      <div className="w-full max-w-md">
        <div className="card space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--brand-accent)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Forgot password</h1>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Enter your email and we'll send a reset link.
            </p>
          </div>

          {state?.ok ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-[var(--fg)]">{state.message}</p>
              <Link href="/sign-in" className="btn-primary mt-2">Back to sign in</Link>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {state && !state.ok && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {state.message}
                </div>
              )}
              <div>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full"
                  placeholder="you@example.com"
                />
              </div>
              <button type="submit" disabled={pending} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </button>
            </form>
          )}

          <div className="text-center">
            <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
