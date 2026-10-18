"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, translateMessage, type Translator } from "@/i18n";
import type { Locale } from "@/lib/types";

interface I18nValue {
  locale: Locale;
  t: Translator;
  /** Translates a service/validation message key, falling back to the raw text. */
  tm: (message: string | undefined | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => {
    const t = makeT(locale);
    return { locale, t, tm: (m: string | undefined | null) => (m ? translateMessage(t, m) : "") };
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
