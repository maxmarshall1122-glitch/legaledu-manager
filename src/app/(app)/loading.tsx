import { Loader2 } from "lucide-react";
import { getLocale } from "@/lib/auth/server";
import { makeT } from "@/i18n";

export default async function Loading() {
  const t = makeT(await getLocale());
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
