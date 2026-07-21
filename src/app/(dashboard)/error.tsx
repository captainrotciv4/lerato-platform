"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isNeonColdStart =
    error.message?.includes("fetch failed") ||
    error.message?.includes("Error connecting to database") ||
    error.message?.includes("ETIMEDOUT");

  useEffect(() => {
    if (!isNeonColdStart) console.error(error);
  }, [error, isNeonColdStart]);

  if (isNeonColdStart) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center px-4">
        <div className="h-12 w-12 rounded-full border-4 border-[var(--brand-primary)] border-t-transparent animate-spin" />
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--fg)]">
            Database is waking up…
          </h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)] max-w-sm">
            The serverless database takes a moment to start after a period of
            inactivity. This only happens on the first load.
          </p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="font-display text-xl font-bold text-[var(--fg)]">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--fg-muted)] max-w-sm font-mono break-all">
        {error.digest ?? error.message}
      </p>
      <button
        onClick={reset}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--fg)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
