"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileStack,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Scale,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLocaleAction, setThemeAction, signOutAction } from "@/app/actions/session";
import { useI18n } from "./i18n-provider";
import { buttonClass, cn } from "./ui";

const ICONS = {
  dashboard: LayoutDashboard,
  students: Users,
  groups: GraduationCap,
  subjects: BookOpen,
  assignments: NotebookPen,
  submissions: FileStack,
  grading: ClipboardCheck,
  materials: Library,
  reports: BarChart3,
  settings: Settings,
  my: FolderOpen,
  feedback: ClipboardCheck,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/my" ? pathname === "/my" || pathname.startsWith("/my/assignments") : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Scale className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="font-serif text-base font-semibold text-foreground">{t("app.name")}</p>
        <p className="text-xs text-muted">{t("app.tagline")}</p>
      </div>
    </div>
  );
}

export function LanguageSwitcher() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("common.languageSwitcher")} className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {(["uz", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          onClick={() =>
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            })
          }
          className={cn("rounded px-2 py-1 text-xs font-semibold uppercase", locale === l ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground")}
        >
          <span aria-hidden="true">{l}</span>
          <span className="sr-only">{l === "uz" ? t("common.uzbek") : t("common.english")}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(initial === "dark");
  return (
    <button
      type="button"
      className={buttonClass("ghost", "icon")}
      aria-label={t("common.toggleTheme")}
      aria-pressed={dark}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        void setThemeAction(next ? "dark" : "light");
      }}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

function SearchBox({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <form action="/search" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor="global-search" className="sr-only">
        {t("common.search")}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        id="global-search"
        name="q"
        type="search"
        minLength={2}
        maxLength={100}
        placeholder={t("common.searchPlaceholder")}
        className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-muted/70"
      />
    </form>
  );
}

export function AppShell({
  nav,
  user,
  demo,
  theme,
  children,
}: {
  nav: NavItem[];
  user: { name: string; role: string };
  demo: boolean;
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("app.skipToContent")}
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface py-5 lg:flex">
        <Brand />
        <nav aria-label={t("nav.mainNavigation")} className="mt-6 flex-1 overflow-y-auto px-3">
          <NavLinks items={nav} />
        </nav>
      </aside>

      {/* Mobile drawer */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface py-5 shadow-xl lg:hidden">
            <Dialog.Title className="sr-only">{t("nav.mainNavigation")}</Dialog.Title>
            <Dialog.Description className="sr-only">{t("nav.mainNavigation")}</Dialog.Description>
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <Dialog.Close className={buttonClass("ghost", "icon")} aria-label={t("nav.closeMenu")}>
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <nav aria-label={t("nav.mainNavigation")} className="mt-6 flex-1 overflow-y-auto px-3">
              <NavLinks items={nav} onNavigate={() => setOpen(false)} />
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-64">
        {demo && (
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning sm:text-sm" role="note">
            {t("app.demoBanner")}
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur sm:gap-3 lg:px-8">
          <button type="button" className={buttonClass("ghost", "icon", "lg:hidden")} onClick={() => setOpen(true)} aria-label={t("nav.openMenu")}>
            <Menu className="h-5 w-5" />
          </button>
          <SearchBox className="min-w-0 flex-1 max-w-xl" />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle initial={theme} />
            <Dropdown.Root>
              <Dropdown.Trigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-muted" aria-label={t("common.signedInAs", { name: user.name })}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden="true">
                  {user.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="hidden text-left text-sm leading-tight md:block">
                  <span className="block max-w-40 truncate font-medium text-foreground">{user.name}</span>
                  <span className="block text-xs text-muted">{user.role}</span>
                </span>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-lg">
                  <Dropdown.Label className="px-2 py-1.5 text-xs text-muted">{t("common.signedInAs", { name: user.name })}</Dropdown.Label>
                  <Dropdown.Separator className="my-1 h-px bg-border" />
                  <Dropdown.Item asChild>
                    <form action={signOutAction}>
                      <button type="submit" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted">
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        {t("common.signOut")}
                      </button>
                    </form>
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
