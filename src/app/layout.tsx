import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/auth/server";
import { configProblem } from "@/lib/config";
import { makeT } from "@/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return {
    title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
    description: t("app.tagline"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get("le_theme")?.value === "dark" ? "dark" : "light";
  const problem = configProblem();
  if (problem) {
    const t = makeT(locale);
    // Shown instead of the app (and instead of silently falling back to demo data) when Supabase settings are broken.
    return (
      <html lang={locale}>
        <body className="min-h-screen">
          <main id="main" className="mx-auto max-w-xl px-4 py-16">
            <h1 className="font-serif text-2xl font-semibold">{t("setup.title")}</h1>
            <p className="mt-3 text-sm">{t("setup.body")}</p>
            <p className="mt-4 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
              {t(`setup.${problem}`)}
            </p>
            <p className="mt-4 text-sm text-muted">{t("setup.fix")}</p>
          </main>
        </body>
      </html>
    );
  }
  return (
    <html lang={locale} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body className="min-h-screen">
        <I18nProvider locale={locale}>
          {children}
          <Toaster richColors closeButton position="top-right" theme={theme} />
        </I18nProvider>
      </body>
    </html>
  );
}
