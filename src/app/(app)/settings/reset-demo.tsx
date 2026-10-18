"use client";

import { RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/app/actions/session";
import { ConfirmButton } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";

export function ResetDemoButton() {
  const { t } = useI18n();
  return (
    <ConfirmButton
      label={t("settings.resetDemo")}
      icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
      title={t("settings.resetDemo")}
      body={t("settings.resetDemoBody")}
      confirmLabel={t("settings.resetDemo")}
      action={resetDemoAction}
    />
  );
}
