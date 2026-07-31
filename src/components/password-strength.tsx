"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@/lib/auth/password-rules";

export function PasswordStrengthChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.test(password);
        return (
          <li
            key={req.id}
            className={`flex items-center gap-1.5 text-xs ${met ? "text-emerald-700" : "text-[var(--fg-muted)]"}`}
          >
            {met
              ? <Check className="h-3 w-3 shrink-0" />
              : <X className="h-3 w-3 shrink-0 opacity-40" />
            }
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}
