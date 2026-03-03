import { useEffect, useMemo, useRef, useState } from "react";
import { fromLonLat } from "ol/proj";
import { useAircraftStore } from "../features/aircraft/store/useAircraftStore";
import { useMapContext } from "../features/map/context/MapContext";
import { filterAircraftInViewport } from "../features/search/hooks/useSearchAircraft";
import type { SearchResult } from "../features/search/types/searchTypes";
import { useMediaQuery } from "../shared/hooks/useMediaQuery";
import { useI18n } from "../shared/i18n/I18nProvider";

const RECENT_STORAGE_KEY = "tracking-ui-command-bar-recent";
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 6;
const FOCUS_ZOOM = 9;

type RecentEntry = {
  icao: string;
  label: string;
  subtitle: string;
};

type CommandBarProps = {
  isOpen: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenSearchPanel: () => void;
  onOpenWatchlistPanel: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAdminUsers: () => void;
  onOpenAdminApiKeys: () => void;
};

type CommandItem =
  | { id: string; kind: "recent"; label: string; subtitle: string; run: () => void }
  | { id: string; kind: "aircraft"; label: string; subtitle: string; run: () => void }
  | { id: string; kind: "command"; label: string; subtitle: string; shortcut?: string; run: () => void };

export function CommandBar({
  isOpen,
  isAuthenticated,
  isAdmin,
  onOpen,
  onClose,
  onOpenSearchPanel,
  onOpenWatchlistPanel,
  onOpenLogin,
  onOpenRegister,
  onOpenAdminUsers,
  onOpenAdminApiKeys,
}: CommandBarProps): JSX.Element {
  const { t } = useI18n();
  const { map } = useMapContext();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const inputRef = useRef<HTMLInputElement>(null);
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectAircraft = useAircraftStore((state) => state.selectAircraft);
  const showDetails = useAircraftStore((state) => state.showDetails);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>(() => loadRecentEntries());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveIndex(0);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [isOpen]);

  const liveResults = useMemo(
    () => (query.trim().length >= MIN_QUERY_LENGTH ? filterAircraftInViewport(aircraft, query).slice(0, RESULT_LIMIT) : []),
    [aircraft, query],
  );

  const runAircraftSelection = (result: SearchResult): void => {
    selectAircraft(result.icao);
    showDetails(result.icao);

    if (map) {
      const view = map.getView();
      const nextZoom = Math.max(Number(view.getZoom?.() ?? 0), FOCUS_ZOOM);
      view.animate?.({
        center: fromLonLat([result.lon, result.lat]),
        zoom: nextZoom,
        duration: 350,
      });
    }

    const nextRecent = saveRecentEntry({
      icao: result.icao,
      label: result.callsign ?? result.registration ?? result.icao.toUpperCase(),
      subtitle: `${result.icao.toUpperCase()}${result.aircraftType ? ` · ${result.aircraftType}` : ""}`,
    });
    setRecentEntries(nextRecent);
    onClose();
  };

  const recentItems: CommandItem[] = recentEntries.map((entry) => ({
    id: `recent-${entry.icao}`,
    kind: "recent",
    label: entry.label,
    subtitle: entry.subtitle,
    run: () => {
      const match = Object.values(aircraft).find((item) => item.icao.toLowerCase() === entry.icao.toLowerCase());
      if (match) {
        runAircraftSelection({
          icao: match.icao,
          callsign: match.callsign ?? undefined,
          registration: match.registration ?? undefined,
          aircraftType: match.aircraftType ?? undefined,
          lat: match.lat,
          lon: match.lon,
          altitude: match.altitude ?? undefined,
          speed: match.speed ?? undefined,
          heading: match.heading ?? undefined,
          eventTime: match.eventTime ?? 0,
          sourceId: match.sourceId ?? undefined,
          operator: match.operator ?? undefined,
        });
        return;
      }

      selectAircraft(entry.icao);
      showDetails(entry.icao);
      onClose();
    },
  }));

  const aircraftItems: CommandItem[] = liveResults.map((result) => ({
    id: `aircraft-${result.icao}`,
    kind: "aircraft",
    label: result.callsign ?? result.registration ?? result.icao.toUpperCase(),
    subtitle: [
      result.icao.toUpperCase(),
      result.aircraftType,
      result.altitude != null ? `${result.altitude.toLocaleString()} ft` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    run: () => runAircraftSelection(result),
  }));

  const commandItems: CommandItem[] = [
    {
      id: "cmd-open-search",
      kind: "command",
      label: t("commandbar.openSearch"),
      shortcut: "Ctrl+K",
      subtitle: t("commandbar.openSearchSubtitle"),
      run: () => {
        onOpenSearchPanel();
        onClose();
      },
    },
    {
      id: "cmd-open-watchlist",
      kind: "command",
      label: t("commandbar.openWatchlist"),
      shortcut: "Ctrl+W",
      subtitle: isAuthenticated ? t("commandbar.openWatchlistSubtitle") : t("commandbar.openWatchlistAuthSubtitle"),
      run: () => {
        if (isAuthenticated) {
          onOpenWatchlistPanel();
        } else {
          onOpenLogin();
        }
        onClose();
      },
    },
    isAuthenticated
      ? {
          id: "cmd-back-to-map",
          kind: "command",
          label: t("commandbar.backToMap"),
          subtitle: t("commandbar.backToMapSubtitle"),
          run: () => onClose(),
        }
      : {
          id: "cmd-open-login",
          kind: "command",
          label: t("commandbar.openLogin"),
          subtitle: t("commandbar.openLoginSubtitle"),
          run: () => {
            onOpenLogin();
            onClose();
          },
        },
    !isAuthenticated
      ? {
          id: "cmd-open-register",
          kind: "command",
          label: t("commandbar.createAccount"),
          subtitle: t("commandbar.createAccountSubtitle"),
          run: () => {
            onOpenRegister();
            onClose();
          },
        }
      : null,
    isAdmin
      ? {
          id: "cmd-open-admin-users",
          kind: "command",
          label: t("commandbar.openAdminUsers"),
          subtitle: t("commandbar.openAdminUsersSubtitle"),
          run: () => {
            onOpenAdminUsers();
            onClose();
          },
        }
      : null,
    isAdmin
      ? {
          id: "cmd-open-admin-api-keys",
          kind: "command",
          label: t("commandbar.openApiKeys"),
          subtitle: t("commandbar.openApiKeysSubtitle"),
          run: () => {
            onOpenAdminApiKeys();
            onClose();
          },
        }
      : null,
  ].filter(Boolean) as CommandItem[];

  const groupedItems = [
    { id: "recent", title: t("commandbar.recent"), items: recentItems.slice(0, 4) },
    { id: "live", title: t("commandbar.liveAircraft"), items: aircraftItems },
    { id: "commands", title: t("commandbar.commands"), items: commandItems },
  ].filter((group) => group.items.length > 0);

  const flatItems = groupedItems.flatMap((group) => group.items);

  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(flatItems.length - 1, 0));
    }
  }, [activeIndex, flatItems.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (flatItems.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % flatItems.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + flatItems.length) % flatItems.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        flatItems[activeIndex]?.run();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, flatItems, isOpen, onClose]);

  return (
    <div className={`pointer-events-none absolute z-40 ${isMobile ? "right-16 top-4" : "right-20 top-4"}`}>
      <button
        aria-label={t("toolbar.search")}
        className="glass-panel-strong pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full text-slate-200 transition hover:bg-slate-900/95"
        onClick={onOpen}
        type="button"
      >
        <SearchIcon />
      </button>

      {isOpen ? (
        <>
          <button
            aria-label={t("commandbar.closeOverlay")}
            className="fixed inset-0 -z-10 h-screen w-screen bg-slate-950/35"
            onClick={onClose}
            type="button"
          />
          <section
            className={`glass-panel-strong pointer-events-auto absolute overflow-hidden border border-slate-700/80 animate-slide-in-up ${
              isMobile
                ? "left-[-1rem] right-[-1rem] top-14 w-[calc(100vw-1.5rem)] rounded-[24px]"
                : "right-0 top-14 w-[min(32rem,calc(100vw-6rem))] rounded-[28px]"
            }`}
          >
            <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-4">
              <SearchIcon />
              <input
                aria-label={t("commandbar.input")}
                className="min-h-11 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("commandbar.placeholderOpen")}
                ref={inputRef}
                type="text"
                value={query}
              />
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 px-3 py-2 text-[11px] text-slate-400 transition hover:text-slate-200"
                onClick={onClose}
                type="button"
              >
                Esc
              </button>
            </div>

            <div className={`overflow-y-auto p-3 ${isMobile ? "max-h-[min(56vh,28rem)]" : "max-h-[420px]"}`}>
              {groupedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700/80 px-4 py-10 text-center text-sm text-slate-500">
                  {t("commandbar.noResults")}
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedItems.map((group) => (
                    <div key={group.id}>
                      <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">{group.title}</p>
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const itemIndex = flatItems.findIndex((entry) => entry.id === item.id);
                          const isActive = itemIndex === activeIndex;
                          return (
                            <button
                              className={`flex min-h-11 w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                isActive
                                  ? "border-cyan-400/50 bg-cyan-400/10 text-slate-100"
                                  : "border-transparent bg-slate-900/65 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                              }`}
                              key={item.id}
                              onClick={item.run}
                              onMouseEnter={() => setActiveIndex(itemIndex)}
                              type="button"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{item.label}</div>
                                <div className="mt-1 truncate text-xs text-slate-500">{item.subtitle}</div>
                              </div>
                              {"shortcut" in item && item.shortcut ? (
                                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-400">
                                  {item.shortcut}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 text-[11px] text-slate-500">
              <span>{t("commandbar.footerHint")}</span>
              <span>{t("commandbar.items", { count: flatItems.length })}</span>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function loadRecentEntries(): RecentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecentEntry(entry: RecentEntry): RecentEntry[] {
  if (typeof window === "undefined") {
    return [entry];
  }

  const next = [entry, ...loadRecentEntries().filter((item) => item.icao !== entry.icao)].slice(0, 6);
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function SearchIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
