// Pure regex — no Node deps — safe for client AND server
export const PASSWORD_REQUIREMENTS: Array<{ id: string; label: string; test: (p: string) => boolean }> = [
  { id: "length",  label: "At least 8 characters",         test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter (A–Z)",     test: (p) => /[A-Z]/.test(p) },
  { id: "lower",   label: "One lowercase letter (a–z)",     test: (p) => /[a-z]/.test(p) },
  { id: "number",  label: "One number (0–9)",               test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "One special character (!@#$…)",  test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Returns the label of the first failed rule, or null if all pass. */
export function validatePassword(password: string): string | null {
  for (const r of PASSWORD_REQUIREMENTS) {
    if (!r.test(password)) return r.label;
  }
  return null;
}
