"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { resetPassword } from "./actions";
import { use } from "react";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const boundAction = resetPassword.bind(null, token);
  const [state, action, pending] = useActionState(boundAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] px-4">
      <div className="w-full max-w-md">
        <div className="card space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--brand-accent)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Set new password</h1>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">Choose a strong password of at least 8 characters.</p>
          </div>

          {state?.ok ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-[var(--fg)]">{state.message}</p>
              <Link href="/sign-in" className="btn-primary mt-2">Sign in</Link>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {state && !state.ok && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{state.message}</span>
                </div>
              )}
              <div>
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mt-1 w-full"
                  placeholder="Repeat password"
                />
              </div>
              <button type="submit" disabled={pending} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </button>
            </form>
          )}

          {!state?.ok && (
            <div className="text-center">
              <Link href={"/sign-in/forgot" as any} className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline">
                Request a new reset link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
