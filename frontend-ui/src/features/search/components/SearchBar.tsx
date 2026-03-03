import { useRef } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useSearchStore } from "../store/useSearchStore";
import type { SearchMode } from "../types/searchTypes";

export function SearchBar(): JSX.Element {
  const { t } = useI18n();
  const query = useSearchStore((s) => s.filters.query);
  const mode = useSearchStore((s) => s.filters.mode);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setMode = useSearchStore((s) => s.setMode);
  const clearSearch = useSearchStore((s) => s.clearSearch);
  const inputRef = useRef<HTMLInputElement>(null);
  const modes: Array<{ id: SearchMode; label: string; title: string }> = [
    { id: "viewport", label: t("search.mode.live"), title: t("search.mode.liveTitle") },
    { id: "global", label: t("search.mode.global"), title: t("search.mode.globalTitle") },
    { id: "history", label: t("search.mode.history"), title: t("search.mode.historyTitle") },
  ];

  return (
    <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
      <div className="flex rounded-md bg-slate-800 p-0.5">
        {modes.map((m) => (
          <button
            className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
              mode === m.id ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.title}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 15z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          aria-label={t("search.inputLabel")}
          autoFocus
          className="w-full rounded border border-slate-600 bg-slate-800 py-1.5 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          minLength={2}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "viewport"
              ? t("search.inputPlaceholder.live")
              : mode === "global"
                ? t("search.inputPlaceholder.global")
                : t("search.inputPlaceholder.history")
          }
          ref={inputRef}
          type="text"
          value={query}
        />

        {query ? (
          <button
            aria-label={t("search.clear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            onClick={() => {
              clearSearch();
              inputRef.current?.focus();
            }}
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {mode === "viewport" && query.length > 0 && query.length < 2 ? (
        <p className="text-[10px] text-slate-500">{t("search.minChars")}</p>
      ) : null}
    </div>
  );
}
