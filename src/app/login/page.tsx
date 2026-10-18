import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { LanguageSwitcher } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { DEMO_PASSWORD, getLocale, getSessionUser } from "@/lib/auth/server";
import { appMode } from "@/lib/config";
import { DEMO_ACCOUNTS } from "@/lib/demo/seed";
import { makeT } from "@/i18n";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "student" ? "/my" : "/dashboard");
  const locale = await getLocale();
  const t = makeT(locale);
  const demo = appMode() === "demo";
  return (
    <div className="flex min-h-screen flex-col">
      {demo && (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning sm:text-sm" role="note">
          {t("app.demoBanner")}
        </div>
      )}
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="font-serif text-2xl font-semibold text-foreground">{t("auth.signInTitle")}</h1>
            <p className="mt-1 text-sm text-muted">{t("auth.signInSubtitle")}</p>
          </div>
          <Card className="p-6">
            <LoginForm demoAccounts={demo ? DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.role, name: a.full_name })) : []} />
          </Card>
          {demo && (
            <p className="mt-4 text-center text-xs text-muted">
              {t("auth.demoAccountsHint")} {t("auth.demoPasswordHint", { password: DEMO_PASSWORD() })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
