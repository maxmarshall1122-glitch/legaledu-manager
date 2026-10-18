import { FileQuestion } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";
import { getLocale } from "@/lib/auth/server";
import { makeT } from "@/i18n";

export default async function NotFound() {
  const t = makeT(await getLocale());
  return (
    <main id="main" className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon={<FileQuestion className="h-10 w-10" />}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFound")}
        action={<LinkButton href="/">{t("errors.goHome")}</LinkButton>}
      />
    </main>
  );
}
