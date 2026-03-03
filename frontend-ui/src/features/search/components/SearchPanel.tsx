import { useI18n } from "../../../shared/i18n/I18nProvider";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useSearchAircraft } from "../hooks/useSearchAircraft";
import { useSearchStore } from "../store/useSearchStore";
import { AdvancedSearchForm } from "./AdvancedSearchForm";
import { SearchBar } from "./SearchBar";
import { SearchHighlightLayer } from "./SearchHighlightLayer";
import { SearchResultList } from "./SearchResultList";

type SearchPanelProps = {
  onClose: () => void;
  dockClassName?: string;
  animationClassName?: string;
  enableSwipeClose?: boolean;
};

export function SearchPanel({
  onClose,
  dockClassName,
  animationClassName,
  enableSwipeClose = false,
}: SearchPanelProps): JSX.Element {
  useSearchAircraft();
  const { t } = useI18n();

  const results = useSearchStore((s) => s.results);
  const isSearching = useSearchStore((s) => s.isSearching);
  const error = useSearchStore((s) => s.error);
  const filters = useSearchStore((s) => s.filters);
  const mode = filters.mode;
  const query = filters.query;
  const hasHistoryCriteria = Boolean(
    filters.query.trim()
      || filters.icao
      || filters.callsign
      || filters.registration
      || filters.aircraftType
      || filters.timeFrom
      || filters.timeTo
      || filters.altitudeMin != null
      || filters.altitudeMax != null
      || filters.speedMin != null
      || filters.speedMax != null
      || filters.sourceId
      || filters.boundingBox,
  );
  const showViewportHint = !isSearching && !error && mode === "viewport" && query.length < 2;
  const showGlobalHint = !isSearching && !error && mode === "global" && query.length < 2;
  const showHistoryHint = !isSearching && !error && mode === "history" && !hasHistoryCriteria;
  const showResults = !isSearching && !error && !showViewportHint && !showGlobalHint && !showHistoryHint;

  return (
    <>
      <SearchHighlightLayer />
      <OverlayPanel
        ariaLabel="Search panel"
        animationClassName={animationClassName}
        closeLabel={t("search.close")}
        description={t("search.description")}
        dockClassName={dockClassName}
        enableSwipeClose={enableSwipeClose}
        onClose={onClose}
        title={t("search.title")}
      >
        <SearchBar />
        {mode === "history" ? <AdvancedSearchForm /> : null}

        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <p className="px-4 py-4 text-center text-xs text-slate-500">{t("search.searching")}</p>
          ) : null}

          {!isSearching && error ? (
            <div className="mx-3 mt-2 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          ) : null}

          {showResults ? (
            <>
              {(mode === "history" ? hasHistoryCriteria : query.length >= 2) ? (
                <div className="border-b border-slate-700/50 px-4 py-1.5">
                  <span className="text-[10px] text-slate-500">
                    {results.length === 0
                      ? t("search.noResults")
                      : results.length === 50
                        ? t("search.resultSummaryFirst50", {
                            count: results.length,
                            suffix: results.length !== 1 ? "s" : "",
                          })
                        : t("search.resultSummary", {
                            count: results.length,
                            suffix: results.length !== 1 ? "s" : "",
                          })}
                  </span>
                </div>
              ) : null}
              <SearchResultList results={results} />
            </>
          ) : null}

          {showViewportHint ? (
            <div className="mt-8 px-4 text-center">
              <p className="text-xs text-slate-500">{t("search.viewportHint")}</p>
            </div>
          ) : null}

          {showGlobalHint ? (
            <div className="mt-8 px-4 text-center">
              <p className="text-xs text-slate-500">{t("search.globalHint")}</p>
            </div>
          ) : null}

          {showHistoryHint ? (
            <div className="mt-8 px-4 text-center">
              <p className="text-xs text-slate-500">{t("search.historyHint")}</p>
            </div>
          ) : null}
        </div>
      </OverlayPanel>
    </>
  );
}
