"use client";

import { useEffect } from "react";

export default function RootError({
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

  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif" }}
      className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4 bg-white"
    >
      {isNeonColdStart ? (
        <>
          <div className="h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Database is waking up…
            </h1>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">
              The serverless database takes a moment to start after a period of inactivity.
            </p>
          </div>
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-sm text-gray-500 font-mono">{error.digest ?? error.message}</p>
          <button
            onClick={reset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
