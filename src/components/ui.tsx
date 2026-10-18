import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import { forwardRef } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary: "bg-primary-soft text-primary hover:brightness-95",
  outline: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-110 shadow-sm dark:text-background",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
  },
);

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "py-2 min-h-24", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(fieldBase, "h-10 pr-8", className)} {...p} />;
});

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted border-border",
  info: "bg-info-soft text-info border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  primary: "bg-primary-soft text-primary border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export const WORK_STATUS_TONE: Record<string, Tone> = {
  not_assigned: "neutral",
  assigned: "neutral",
  submitted: "info",
  under_review: "primary",
  revision_required: "warning",
  resubmitted: "info",
  graded: "success",
  completed: "success",
  draft: "neutral",
  published: "success",
  archived: "warning",
  pending: "warning",
  approved: "success",
  edited: "info",
  rejected: "danger",
};

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("border-b border-border bg-surface-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)} {...p}>
      {children}
    </th>
  );
}
export function Td({ children, className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-border px-4 py-3 align-top", className)} {...p}>
      {children}
    </td>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted" aria-hidden="true">{icon}</div>}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, href }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; href?: string }) {
  const inner = (
    <Card className={cn("h-full p-4", href && "transition-colors hover:border-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className="text-primary" aria-hidden="true">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function DescriptionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
