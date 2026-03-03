import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_LOCALES, LANGUAGE_STORAGE_KEY, MESSAGES, type AppLanguage } from "./messages";

type TranslateValues = Record<string, string | number>;

type I18nContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, values?: TranslateValues) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  locale: LANGUAGE_LOCALES.en,
  setLanguage: () => undefined,
  t: (key, values) => interpolate(MESSAGES.en[key] ?? key, values),
});

type I18nProviderProps = {
  children: ReactNode;
  defaultLanguage?: AppLanguage;
};

export function I18nProvider({
  children,
  defaultLanguage = "vi",
}: I18nProviderProps): JSX.Element {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") {
      return defaultLanguage;
    }

    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === "en" || saved === "vi" ? saved : defaultLanguage;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: LANGUAGE_LOCALES[language],
      setLanguage: setLanguageState,
      t: (key, values) => interpolate(MESSAGES[language][key] ?? MESSAGES.en[key] ?? key, values),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
