import { Download, ExternalLink } from "lucide-react";
import type { Translator } from "@/i18n";
import { formatBytes, formatDate } from "@/lib/format";
import type { Assignment, Locale, RubricCriterion, Subject, TeachingMaterial } from "@/lib/types";
import { subjectName } from "@/lib/services/core";
import { Badge } from "./ui";

/** Student-facing presentation of an assignment (also used as the lecturer's "student view" preview). */
export function AssignmentView({
  t,
  locale,
  assignment,
  subject,
  criteria,
  materials,
}: {
  t: Translator;
  locale: Locale;
  assignment: Assignment;
  subject: Subject | null;
  criteria: RubricCriterion[];
  materials: TeachingMaterial[];
}) {
  return (
    <article lang={assignment.language} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{subjectName(subject, locale)}</Badge>
        <Badge>{t(`assignmentType.${assignment.assignment_type}`)}</Badge>
        <Badge>{assignment.language === "uz" ? t("common.uzbek") : t("common.english")}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{t("assignments.issueDate")}</dt>
          <dd>{formatDate(assignment.issue_date, locale, true)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("portal.deadline")}</dt>
          <dd className="font-semibold">{formatDate(assignment.deadline, locale, true)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("assignments.maxScore")}</dt>
          <dd className="tabular-nums">{assignment.max_score}</dd>
        </div>
      </dl>
      {assignment.description && <p className="whitespace-pre-line text-sm text-foreground">{assignment.description}</p>}
      <section>
        <h3 className="mb-1 text-sm font-semibold">{t("portal.instructions")}</h3>
        <div className="whitespace-pre-line rounded-md bg-surface-muted p-4 text-sm leading-relaxed">{assignment.instructions ?? t("common.missing")}</div>
      </section>
      {criteria.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">{t("assignments.rubric")}</h3>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {criteria.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 px-3 py-2">
                <span>{c.title}</span>
                <span className="whitespace-nowrap tabular-nums text-muted">
                  {c.max_points} {t("common.points")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-1 text-sm font-semibold">{t("portal.attachments")}</h3>
        {materials.length === 0 ? (
          <p className="text-sm text-muted">{t("assignments.noAttachments")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {materials.map((m) => (
              <li key={m.id}>
                {m.storage_key ? (
                  <a href={`/api/materials/${m.id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {m.title} <span className="text-xs text-muted">({formatBytes(m.size_bytes)})</span>
                  </a>
                ) : m.external_url ? (
                  <a href={m.external_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {m.title}
                  </a>
                ) : (
                  m.title
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
