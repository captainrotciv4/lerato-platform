import Link from "next/link";

export const metadata = { title: "Unauthorized — Lerato Platform" };

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] px-4">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--brand-accent)]" />
        <h1 className="font-display text-2xl font-bold text-[var(--fg)]">No access</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Your account isn&apos;t a member of any organization on this platform yet, or you tried to open an organization you don&apos;t have access to.
        </p>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          If this looks wrong, contact your administrator.
        </p>
        <Link href="/sign-in" className="btn-secondary mt-6 inline-block">
          Sign in with a different account
        </Link>
      </div>
    </div>
  );
}
