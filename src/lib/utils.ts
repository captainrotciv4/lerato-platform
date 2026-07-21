import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combine class names with Tailwind merge to handle conflicting utility classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as KES currency, e.g. 895000 → "KES 895,000". */
export function formatKES(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return `KES ${num.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

/** Format a date as "12 Aug 2026" (en-GB short month). */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Format a person's full name from components, skipping missing parts cleanly. */
export function fullName(first: string, middle?: string | null, last?: string): string {
  return [first, middle, last].filter(Boolean).join(" ");
}

/** Initials of a name for avatars — up to 2 chars. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
