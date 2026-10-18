import type { Locale } from "@/lib/types";
import en, { type Dict } from "./en";
import uz from "./uz";

export const LOCALES: Locale[] = ["uz", "en"];
export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "le_lang";

export const dictionaries: Record<Locale, Dict> = { uz, en };

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TKey = Paths<Dict>;
export type TParams = Record<string, string | number>;
export type Translator = (key: TKey, params?: TParams) => string;

export function isLocale(v: unknown): v is Locale {
  return v === "uz" || v === "en";
}

export function lookup(dict: Dict, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

export function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function makeT(locale: Locale): Translator {
  const dict = dictionaries[locale];
  return (key, params) => interpolate(lookup(dict, key) ?? lookup(en, key) ?? key, params);
}

/**
 * Translate a message that may be a translation key (e.g. Zod issues and
 * service errors carry keys such as "validation.required"), optionally with
 * JSON params encoded as "key|{json}".
 */
export function translateMessage(t: Translator, message: string): string {
  const [key, json] = message.split("|", 2);
  let params: TParams | undefined;
  if (json) {
    try {
      params = JSON.parse(json);
    } catch {
      params = undefined;
    }
  }
  const translated = t(key as TKey, params);
  return translated === key ? message : translated;
}
