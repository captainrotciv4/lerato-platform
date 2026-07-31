"use client";

import { useState } from "react";
import { PasswordStrengthChecklist } from "./password-strength";

interface Props {
  name: string;
  id?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
}

/** Drop-in password input that shows a live strength checklist below it. */
export function PasswordInputWithStrength({ name, id, required, className, placeholder, autoComplete }: Props) {
  const [value, setValue] = useState("");
  return (
    <>
      <input
        id={id ?? name}
        name={name}
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        className={className ?? "mt-1 w-full"}
        placeholder={placeholder}
        autoComplete={autoComplete ?? "new-password"}
      />
      <PasswordStrengthChecklist password={value} />
    </>
  );
}
