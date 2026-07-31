"use client";

import { useActionState } from "react";
import { sendResetLink, removeMember } from "./actions";
import { Loader2, MailCheck, Copy } from "lucide-react";

interface Props {
  org: string;
  userId: string;
  membershipId: string;
  isSelf: boolean;
}

export function TeamActionsCell({ org, userId, membershipId, isSelf }: Props) {
  const boundSend = sendResetLink.bind(null, org, userId);
  const [resetState, resetAction, resetPending] = useActionState(boundSend, null);

  return (
    <div className="flex items-center justify-end gap-3">
      {/* Send / resend password reset link */}
      <form action={resetAction}>
        <button
          type="submit"
          disabled={resetPending}
          className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline"
          title="Send password reset link"
        >
          {resetPending
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <MailCheck className="h-3 w-3" />
          }
          Reset password
        </button>
      </form>

      {/* Inline result */}
      {resetState && (
        <span className={`text-xs ${resetState.ok ? "text-emerald-700" : "text-red-600"}`}>
          {resetState.message}
          {resetState.resetUrl && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(resetState.resetUrl!)}
              className="ml-1 inline-flex items-center gap-0.5 underline"
              title="Copy reset link"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
          )}
        </span>
      )}

      {/* Remove */}
      {!isSelf && (
        <form action={removeMember.bind(null, org, membershipId)}>
          <button className="text-xs text-red-500 hover:underline">Remove</button>
        </form>
      )}
    </div>
  );
}
