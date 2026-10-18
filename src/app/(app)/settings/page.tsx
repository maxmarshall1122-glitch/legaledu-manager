import { cookies } from "next/headers";
import { CheckCircle2, XCircle } from "lucide-react";
import { LanguageSwitcher, ThemeToggle } from "@/components/app-shell";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, Table, Td, Th } from "@/components/ui";
import { providerStatus } from "@/lib/ai/providers";
import { requirePageCtx } from "@/lib/auth/server";
import { appMode, dataRetentionDays, uploadLimits } from "@/lib/config";
import { ALLOWED_EXTENSIONS } from "@/lib/files/validate";
import { formatDate } from "@/lib/format";
import { isStaff } from "@/lib/services/core";
import { listAuditLog } from "@/lib/services/search";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { ResetDemoButton } from "./reset-demo";

export const generateMetadata = titled("nav.settings");

export default async function SettingsPage() {
  const ctx = await requirePageCtx();
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const staff = isStaff(ctx.user);
  const mode = appMode();
  const ai = providerStatus();
  const limits = uploadLimits();
  const retention = dataRetentionDays();
  const theme = (await cookies()).get("le_theme")?.value === "dark" ? "dark" : "light";
  const audit = staff ? await listAuditLog(ctx, 100) : [];
  const providerRow = (name: string, p: { configured: boolean; model: string }) => (
    <span className="inline-flex items-center gap-2">
      {p.configured ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <XCircle className="h-4 w-4 text-muted" aria-hidden="true" />}
      {name}: {p.configured ? `${t("ai.configured")} (${p.model})` : t("ai.notConfigured")}
    </span>
  );

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("settings.preferences")} />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("settings.interfaceLanguage")}</span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("settings.themeLabel")}</span>
              <ThemeToggle initial={theme} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("settings.profile")} />
          <CardBody>
            <DescriptionList
              items={[
                { label: t("common.name"), value: ctx.user.full_name },
                { label: t("auth.email"), value: ctx.user.email ?? t("common.missing") },
                { label: t("common.status"), value: t(`roles.${ctx.user.role}`) },
              ]}
            />
          </CardBody>
        </Card>
        {staff && (
          <Card>
            <CardHeader title={t("settings.system")} />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { label: t("settings.mode"), value: <Badge tone={mode === "supabase" ? "success" : "warning"}>{mode === "supabase" ? t("settings.modeSupabase") : t("settings.modeDemo")}</Badge> },
                  {
                    label: t("settings.aiProviders"),
                    value: (
                      <span className="flex flex-col gap-1">
                        {providerRow("Anthropic Claude", ai.anthropic)}
                        {providerRow("Google Gemini", ai.gemini)}
                      </span>
                    ),
                  },
                  { label: t("settings.maxFileSize"), value: `${Math.round(limits.maxFileBytes / 1024 / 1024)} MB` },
                  { label: t("settings.maxFiles"), value: limits.maxFilesPerSubmission },
                  { label: t("settings.allowedTypes"), value: ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ") },
                ]}
              />
              {!ai.anthropic.configured && !ai.gemini.configured && <Alert tone="info">{t("ai.noProviders")}</Alert>}
              <p className="text-xs text-muted">{t("settings.setupGuide")}</p>
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader title={t("settings.privacy")} />
          <CardBody className="space-y-3 text-sm">
            <p>{t("settings.privacyBody")}</p>
            <p>
              <span className="font-medium">{t("settings.retention")}:</span> {retention ? t("settings.retentionDays", { n: retention }) : t("settings.retentionNotSet")}
            </p>
            <p>{t("settings.deletionProcedure")}</p>
            {staff && mode === "demo" && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted">{t("settings.resetDemoBody")}</p>
                <ResetDemoButton />
              </div>
            )}
          </CardBody>
        </Card>
        {staff && (
          <Card className="lg:col-span-2">
            <CardHeader title={t("settings.auditLog")} />
            {audit.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">{t("settings.auditEmpty")}</p>
              </CardBody>
            ) : (
              <Table className="max-h-[480px] overflow-y-auto">
                <thead>
                  <tr>
                    <Th>{t("common.date")}</Th>
                    <Th>{t("settings.auditActor")}</Th>
                    <Th>{t("settings.auditAction")}</Th>
                    <Th>{t("settings.auditEntity")}</Th>
                    <Th>{t("common.details")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map(({ log, actor }) => (
                    <tr key={log.id}>
                      <Td className="whitespace-nowrap">{formatDate(log.created_at, L, true)}</Td>
                      <Td>{actor?.full_name ?? t("common.missing")}</Td>
                      <Td className="font-mono text-xs">{log.action}</Td>
                      <Td className="font-mono text-xs">
                        {log.entity}
                        {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                      </Td>
                      <Td className="max-w-md truncate font-mono text-xs text-muted">{log.details ? JSON.stringify(log.details) : ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
