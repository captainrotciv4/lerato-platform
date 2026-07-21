import { signIn } from "@/lib/auth";

export const metadata = { title: "Sign in — Lerato Platform" };

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-muted)] px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--brand-accent)]" />
            <h1 className="font-display text-2xl font-bold text-[var(--fg)]">Lerato Platform</h1>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Lerato Foundation · Darajani · Agape in Action
            </p>
          </div>

          <SignInForm searchParams={searchParams} />

          <p className="mt-6 text-center text-xs text-[var(--fg-muted)]">
            By signing in you agree to the platform&apos;s acceptable use policy.
          </p>
        </div>
      </div>
    </div>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <form
      action={async (formData) => {
        "use server";
        await signIn("credentials", {
          email: formData.get("email"),
          password: formData.get("password"),
          redirectTo: params.returnTo || "/",
        });
      }}
      className="space-y-4"
    >
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Sign-in failed. Please check your email and password.
        </div>
      )}
      <div>
        <label htmlFor="email">Email</label>
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
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full"
        />
      </div>
      <button type="submit" className="btn-primary w-full">
        Sign in
      </button>
    </form>
  );
}
