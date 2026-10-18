"use client";

import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { signInAction } from "@/app/actions/session";
import { useI18n } from "@/components/i18n-provider";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ demoAccounts }: { demoAccounts: { email: string; role: string; name: string }[] }) {
  const { t, tm } = useI18n();
  const [state, formAction, pending] = useActionState(signInAction, {});
  const emailRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4" noValidate>
        {state?.error && <Alert tone="danger">{tm(state.error)}</Alert>}
        <Field label={t("auth.email")} htmlFor="email" required>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
        </Field>
        <Field label={t("auth.password")} htmlFor="password" required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
        </Field>
        <Button type="submit" className="w-full justify-center" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
      {demoAccounts.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("auth.demoAccountsTitle")}</p>
          <ul className="space-y-1.5">
            {demoAccounts.map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{a.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {t(`roles.${a.role as "admin"}`)} · {a.email}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (emailRef.current) emailRef.current.value = a.email;
                    document.getElementById("password")?.focus();
                  }}
                >
                  {t("auth.useAccount")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
