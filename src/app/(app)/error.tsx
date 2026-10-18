"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, EmptyState, LinkButton } from "@/components/ui";

/** Safe error boundary: shows a generic message, never internal details. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<AlertTriangle className="h-10 w-10" />}
      title={t("errors.errorTitle")}
      description={t("errors.generic")}
      action={
        <div className="flex gap-2">
          <Button onClick={reset}>{t("errors.retry")}</Button>
          <LinkButton href="/" variant="outline">
            {t("errors.goHome")}
          </LinkButton>
        </div>
      }
    />
  );
}
