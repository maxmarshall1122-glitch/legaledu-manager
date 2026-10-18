import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepoError } from "@/lib/db/repo";
import { AppError } from "@/lib/errors";
import { getLocale } from "@/lib/auth/server";
import { makeT, type TKey } from "@/i18n";

/** Localized <title> for a page: `export const generateMetadata = titled("nav.students");` */
export function titled(key: TKey) {
  return async (): Promise<Metadata> => ({ title: makeT(await getLocale())(key) });
}

/** Renders the 404 page for records that do not exist or that the user may not see (no existence leak). */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    if (e instanceof RepoError && e.code === "not_found") notFound();
    throw e;
  }
}
