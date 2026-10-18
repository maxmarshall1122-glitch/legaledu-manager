import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/auth/server";
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
