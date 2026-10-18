"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/errors";

/** Copies server-side field errors (translation keys) onto React Hook Form fields. */
export function applyServerErrors<T extends FieldValues>(res: ActionResult<unknown>, setError: UseFormSetError<T>) {
  if (res.ok || !res.fieldErrors) return;
  for (const [field, message] of Object.entries(res.fieldErrors)) {
    setError(field as Path<T>, { type: "server", message });
  }
}

/** aria props linking an input to its error/hint text. */
export function aria(id: string, error?: string, hint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
