"use client";

import { useActionState } from "react";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--fg-muted)]" />
        <h2 className="font-display text-base font-semibold text-[var(--fg)]">Change password</h2>
      </div>

      {state?.ok ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.message}
        </div>
      ) : (
        <form action={action} className="space-y-4 max-w-sm">
          {state && !state.ok && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </div>
          )}
          <div>
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </form>
      )}
    </div>
  );
}
