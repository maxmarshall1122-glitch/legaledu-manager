import { cookies } from "next/headers";
import { AppShell, type NavItem } from "@/components/app-shell";
import { requirePageCtx } from "@/lib/auth/server";
import { appMode } from "@/lib/config";
import { isStaff } from "@/lib/services/core";
import { makeT } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageCtx();
  const t = makeT(ctx.locale);
  const nav: NavItem[] = isStaff(ctx.user)
    ? [
        { href: "/dashboard", label: t("nav.dashboard"), icon: "dashboard" },
        { href: "/students", label: t("nav.students"), icon: "students" },
        { href: "/groups", label: t("nav.groups"), icon: "groups" },
        { href: "/subjects", label: t("nav.subjects"), icon: "subjects" },
        { href: "/assignments", label: t("nav.assignments"), icon: "assignments" },
        { href: "/submissions", label: t("nav.submissions"), icon: "submissions" },
        { href: "/grading", label: t("nav.grading"), icon: "grading" },
        { href: "/materials", label: t("nav.materials"), icon: "materials" },
        { href: "/reports", label: t("nav.reports"), icon: "reports" },
        { href: "/settings", label: t("nav.settings"), icon: "settings" },
      ]
    : [
        { href: "/my", label: t("nav.myAssignments"), icon: "my" },
        { href: "/my/feedback", label: t("nav.myFeedback"), icon: "feedback" },
        { href: "/settings", label: t("nav.settings"), icon: "settings" },
      ];
  return (
    <AppShell nav={nav} user={{ name: ctx.user.full_name, role: t(`roles.${ctx.user.role}`) }} demo={appMode() === "demo"} theme={(await cookies()).get("le_theme")?.value === "dark" ? "dark" : "light"}>
      {children}
    </AppShell>
  );
}
