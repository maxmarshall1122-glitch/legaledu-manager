import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { isStaff, subjectName } from "@/lib/services/core";
import { globalSearch } from "@/lib/services/search";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("search.title");

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePageCtx();
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const q = ((await searchParams).q ?? "").trim();
  const r = await globalSearch(ctx, q);
  const staff = isStaff(ctx.user);
  const total = r ? r.students.length + r.assignments.length + r.subjects.length + r.files.length : 0;
  const assignmentHref = (id: string) => (staff ? `/assignments/${id}` : `/my/assignments/${id}`);

  const section = (title: string, items: React.ReactNode[]) =>
    items.length > 0 && (
      <Card>
        <CardHeader title={`${title} (${items.length})`} />
        <CardBody className="p-0">
          <ul className="divide-y divide-border">{items}</ul>
        </CardBody>
      </Card>
    );

  return (
    <>
      <PageHeader title={t("search.title")} description={q ? t("search.resultsFor", { q }) : undefined} />
      {!r ? (
        <Card>
          <EmptyState icon={<Search className="h-10 w-10" />} title={t("search.tooShort")} />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState icon={<Search className="h-10 w-10" />} title={t("search.none")} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {section(
            t("search.students"),
            r.students.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <Link href={`/students/${s.id}`} className="font-medium hover:text-primary">
                  <span className="font-mono text-xs">{s.student_code}</span> — {s.full_name}
                </Link>
              </li>
            )),
          )}
          {section(
            t("search.assignments"),
            r.assignments.map(({ assignment: a, subject }) => (
              <li key={a.id} className="px-5 py-3">
                <Link href={assignmentHref(a.id)} className="font-medium hover:text-primary">
                  {a.code} — {a.title}
                </Link>
                <p className="text-xs text-muted">{subjectName(subject, L)}</p>
              </li>
            )),
          )}
          {section(
            t("search.subjects"),
            r.subjects.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <Link href={`/subjects/${s.id}`} className="font-medium hover:text-primary">
                  {subjectName(s, L)}
                </Link>
              </li>
            )),
          )}
          {section(
            t("search.files"),
            r.files.map(({ file, submission, assignment }) => (
              <li key={file.id} className="px-5 py-3">
                <Link href={`/files/${file.id}`} className="font-medium hover:text-primary">
                  {file.original_name}
                </Link>
                <p className="text-xs text-muted">
                  {submission?.code} · v{file.version} · {assignment?.title}
                </p>
              </li>
            )),
          )}
        </div>
      )}
    </>
  );
}
