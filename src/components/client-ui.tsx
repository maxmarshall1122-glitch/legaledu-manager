"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "./i18n-provider";
import { Button, buttonClass, cn } from "./ui";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-xl",
            wide ? "max-w-3xl" : "max-w-lg",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className={buttonClass("ghost", "icon")} aria-label={t("common.close")}>
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Runs a server action, shows a toast with the (translated) result and refreshes the route. */
export function useAction() {
  const { tm } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; redirectTo?: string; onSuccess?: (d: T) => void } = {}) =>
    new Promise<ActionResult<T>>((resolve) => {
      start(async () => {
        const res = await fn();
        if (res.ok) {
          if (opts.success || res.message) toast.success(tm(res.message ?? opts.success));
          opts.onSuccess?.(res.data);
          if (opts.redirectTo) router.push(opts.redirectTo);
          router.refresh();
        } else {
          toast.error(tm(res.error));
        }
        resolve(res);
      });
    });
  return { run, pending };
}

/** Confirmation dialog for destructive or consequential operations. */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
  success,
  redirectTo,
  variant = "danger",
  size = "sm",
  icon,
  disabled,
  ariaLabel,
}: {
  ariaLabel?: string;
  label: string;
  title: string;
  body: string;
  confirmLabel?: string;
  action: () => Promise<ActionResult<unknown>>;
  success?: string;
  redirectTo?: string;
  variant?: "danger" | "primary" | "outline" | "secondary" | "ghost";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button variant={variant} size={size} disabled={disabled} aria-label={ariaLabel}>
          {icon}
          {label}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted">{body}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonClass("outline", "md")}>{t("common.cancel")}</AlertDialog.Cancel>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              disabled={pending}
              onClick={async () => {
                const res = await run(action, { success, redirectTo });
                if (res.ok) setOpen(false);
              }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel ?? t("common.confirm")}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function SubmitButton({ pending, children, variant = "primary", ...p }: { pending: boolean; children: React.ReactNode; variant?: "primary" | "secondary" | "outline" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="submit" variant={variant} disabled={pending || p.disabled} {...p}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}
