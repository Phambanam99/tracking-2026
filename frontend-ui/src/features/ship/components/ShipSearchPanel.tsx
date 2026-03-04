import { useEffect, useMemo, useRef, useState } from "react";
import { fromLonLat } from "ol/proj";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useMapContext } from "../../map/context/MapContext";
import { useTrackedShipStore } from "../store/useTrackedShipStore";
import { useShipStore } from "../store/useShipStore";
import {
  searchShipGlobal,
  searchShipHistory,
  type ShipSearchBoundingBox,
  type ShipSearchFilters,
  type ShipSearchMode,
  type ShipSearchResult,
} from "../api/shipSearchApi";
import { ShipTrackGroupPicker } from "./ShipTrackGroupPicker";

type ShipSearchPanelProps = {
  onClose: () => void;
  dockClassName?: string;
  animationClassName?: string;
  enableSwipeClose?: boolean;
};

const SEARCH_RESULT_FOCUS_ZOOM = 9;
const INITIAL_FILTERS: ShipSearchFilters = {
  query: "",
  mode: "viewport",
};

export function ShipSearchPanel({
  onClose,
  dockClassName,
  animationClassName,
  enableSwipeClose = false,
}: ShipSearchPanelProps): JSX.Element {
  const { t } = useI18n();
  const { map } = useMapContext();
  const [filters, setFilters] = useState<ShipSearchFilters>(INITIAL_FILTERS);
  const [results, setResults] = useState<ShipSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ships = useShipStore((state) => state.ships);
  const selectedMmsi = useShipStore((state) => state.selectedMmsi);
  const selectShip = useShipStore((state) => state.selectShip);
  const showDetails = useShipStore((state) => state.showDetails);
  const upsertShip = useShipStore((state) => state.upsertShip);
  const trackedMmsis = useTrackedShipStore((state) => state.trackedMmsis);
  const abortRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = filters.mode;
  const query = filters.query;

  const viewportResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    return Object.values(ships)
      .filter((ship) =>
        ship.mmsi.toLowerCase().includes(normalizedQuery) ||
        ship.vesselName?.toLowerCase().includes(normalizedQuery) ||
        ship.imo?.toLowerCase().includes(normalizedQuery) ||
        ship.callSign?.toLowerCase().includes(normalizedQuery) ||
        ship.vesselType?.toLowerCase().includes(normalizedQuery) ||
        ship.destination?.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 50);
  }, [query, ships]);

  const hasHistoryCriteria = Boolean(
    filters.query.trim()
      || filters.mmsi
      || filters.imo
      || filters.callSign
      || filters.vesselName
      || filters.vesselType
      || filters.destination
      || filters.timeFrom
      || filters.timeTo
      || filters.speedMin != null
      || filters.speedMax != null
      || filters.sourceId
      || filters.boundingBox,
  );

  useEffect(() => {
    if (abortRef.current !== null) {
      clearTimeout(abortRef.current);
      abortRef.current = null;
    }

    if (mode === "history") {
      return;
    }

    const debounceMs = mode === "global" ? 500 : 200;
    abortRef.current = setTimeout(() => {
      if (mode === "viewport") {
        setResults(viewportResults.map((ship) => ({
          mmsi: ship.mmsi,
          lat: ship.lat,
          lon: ship.lon,
          speed: ship.speed,
          course: ship.course,
          heading: ship.heading,
          eventTime: ship.eventTime,
          sourceId: ship.sourceId,
          vesselName: ship.vesselName,
          vesselType: ship.vesselType,
          imo: ship.imo,
          callSign: ship.callSign,
          destination: ship.destination,
          navStatus: ship.navStatus,
          isMilitary: ship.metadata?.isMilitary ?? false,
        })));
        setError(null);
        return;
      }

      if (query.length < 2) {
        setResults([]);
        setError(null);
        return;
      }

      setIsSearching(true);
      setError(null);
      searchShipGlobal(query)
        .then((response) => {
          setResults(response.results);
        })
        .catch((searchError: unknown) => {
          setError(searchError instanceof Error ? searchError.message : t("ship.history.failed"));
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, debounceMs);

    return () => {
      if (abortRef.current !== null) {
        clearTimeout(abortRef.current);
      }
    };
  }, [mode, query, t, viewportResults]);

  function handleClick(result: ShipSearchResult): void {
    upsertShip({
      mmsi: result.mmsi,
      lat: result.lat,
      lon: result.lon,
      speed: result.speed ?? null,
      course: result.course ?? null,
      heading: result.heading ?? null,
      navStatus: result.navStatus ?? null,
      vesselName: result.vesselName ?? null,
      vesselType: result.vesselType ?? null,
      imo: result.imo ?? null,
      callSign: result.callSign ?? null,
      destination: result.destination ?? null,
      eta: null,
      eventTime: result.eventTime,
      sourceId: result.sourceId ?? "service-query",
      isHistorical: mode === "history",
      metadata: { isMilitary: result.isMilitary ?? false },
      lastSeen: Date.now(),
    });
    selectShip(result.mmsi, mode);

    if (!map) {
      return;
    }

    const view = map.getView();
    const currentZoom = view.getZoom() ?? SEARCH_RESULT_FOCUS_ZOOM;
    view.animate({
      center: fromLonLat([result.lon, result.lat]),
      zoom: Math.max(currentZoom, SEARCH_RESULT_FOCUS_ZOOM),
      duration: 350,
    });
  }

  function handleOpenDetails(result: ShipSearchResult): void {
    handleClick(result);
    showDetails(result.mmsi, mode);
  }

  function setBoundingBoxField(key: keyof ShipSearchBoundingBox, value: string): void {
    const current = filters.boundingBox;
    const nextValue = value === "" ? undefined : Number(value);
    const nextBoundingBox = {
      north: current?.north,
      south: current?.south,
      east: current?.east,
      west: current?.west,
      [key]: nextValue,
    };
    const hasAnyBounds = Object.values(nextBoundingBox).some((entry) => entry != null);
    setFilters((state) => ({
      ...state,
      boundingBox: hasAnyBounds ? nextBoundingBox as ShipSearchBoundingBox : undefined,
    }));
  }

  function clearSearch(): void {
    setFilters(INITIAL_FILTERS);
    setResults([]);
    setError(null);
    setIsSearching(false);
  }

  function handleHistorySubmit(event: React.FormEvent): void {
    event.preventDefault();
    setIsSearching(true);
    setError(null);
    const { mode: _mode, ...historyFilters } = filters;
    searchShipHistory(historyFilters)
      .then((response) => {
        setResults(response.results);
      })
      .catch((searchError: unknown) => {
        setError(searchError instanceof Error ? searchError.message : t("ship.history.failed"));
      })
      .finally(() => {
        setIsSearching(false);
      });
  }

  const showViewportHint = !isSearching && !error && mode === "viewport" && query.length < 2;
  const showGlobalHint = !isSearching && !error && mode === "global" && query.length < 2;
  const showHistoryHint = !isSearching && !error && mode === "history" && !hasHistoryCriteria;
  const showResults = !isSearching && !error && !showViewportHint && !showGlobalHint && !showHistoryHint;
  const modes: Array<{ id: ShipSearchMode; label: string; title: string }> = [
    { id: "viewport", label: t("ship.search.mode.live"), title: t("ship.search.mode.liveTitle") },
    { id: "global", label: t("ship.search.mode.global"), title: t("ship.search.mode.globalTitle") },
    { id: "history", label: t("ship.search.mode.history"), title: t("ship.search.mode.historyTitle") },
  ];

  return (
    <OverlayPanel
      ariaLabel="Ship search panel"
      animationClassName={animationClassName}
      closeLabel={t("ship.search.close")}
      description={t("ship.search.description")}
      dockClassName={dockClassName}
      enableSwipeClose={enableSwipeClose}
      onClose={onClose}
      title={t("ship.search.title")}
    >
      <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex rounded-md bg-slate-800 p-0.5">
          {modes.map((currentMode) => (
            <button
              className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
                mode === currentMode.id ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
              key={currentMode.id}
              onClick={() => {
                setFilters((state) => ({ ...state, mode: currentMode.id, query: "" }));
                setResults([]);
                setError(null);
              }}
              title={currentMode.title}
              type="button"
            >
              {currentMode.label}
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
            aria-label={t("ship.search.inputLabel")}
            autoFocus
            className="w-full rounded border border-slate-600 bg-slate-800 py-1.5 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            minLength={2}
            onChange={(event) => setFilters((state) => ({ ...state, query: event.target.value }))}
            placeholder={
              mode === "viewport"
                ? t("ship.search.inputPlaceholder.live")
                : mode === "global"
                  ? t("ship.search.inputPlaceholder.global")
                  : t("ship.search.inputPlaceholder.history")
            }
            type="text"
            value={query}
          />

          {query ? (
            <button
              aria-label={t("ship.search.clear")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              onClick={clearSearch}
              type="button"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
        </div>

        {mode !== "history" && query.length > 0 && query.length < 2 ? (
          <p className="text-[10px] text-slate-500">{t("ship.search.minChars")}</p>
        ) : null}
      </div>

      {mode === "history" ? (
        <form className="grid grid-cols-2 gap-2 px-4 pb-3" onSubmit={handleHistorySubmit}>
          <LabeledInput ariaLabel="MMSI" label={t("ship.field.mmsi")} onChange={(value) => setFilters((state) => ({ ...state, mmsi: value || undefined }))} value={filters.mmsi ?? ""} />
          <LabeledInput ariaLabel="IMO" label={t("ship.field.imo")} onChange={(value) => setFilters((state) => ({ ...state, imo: value || undefined }))} value={filters.imo ?? ""} />
          <LabeledInput ariaLabel="Call Sign" label={t("ship.field.callSign")} onChange={(value) => setFilters((state) => ({ ...state, callSign: value || undefined }))} value={filters.callSign ?? ""} />
          <LabeledInput ariaLabel="Vessel Name" label={t("ship.search.field.vesselName")} onChange={(value) => setFilters((state) => ({ ...state, vesselName: value || undefined }))} value={filters.vesselName ?? ""} />
          <LabeledInput ariaLabel="Vessel Type" label={t("ship.field.type")} onChange={(value) => setFilters((state) => ({ ...state, vesselType: value || undefined }))} value={filters.vesselType ?? ""} />
          <LabeledInput ariaLabel="Destination" label={t("ship.field.destination")} onChange={(value) => setFilters((state) => ({ ...state, destination: value || undefined }))} value={filters.destination ?? ""} />
          <LabeledInput ariaLabel="From (UTC)" label={t("history.from")} onChange={(value) => setFilters((state) => ({ ...state, timeFrom: value || undefined }))} type="datetime-local" value={filters.timeFrom ?? ""} />
          <LabeledInput ariaLabel="To (UTC)" label={t("history.to")} onChange={(value) => setFilters((state) => ({ ...state, timeTo: value || undefined }))} type="datetime-local" value={filters.timeTo ?? ""} />
          <LabeledInput ariaLabel="Speed min (kts)" label={t("history.speedMin")} min={0} onChange={(value) => setFilters((state) => ({ ...state, speedMin: value ? Number(value) : undefined }))} type="number" value={filters.speedMin ?? ""} />
          <LabeledInput ariaLabel="Speed max (kts)" label={t("history.speedMax")} min={0} onChange={(value) => setFilters((state) => ({ ...state, speedMax: value ? Number(value) : undefined }))} type="number" value={filters.speedMax ?? ""} />
          <LabeledInput ariaLabel="Source" className="col-span-2" label={t("history.source")} onChange={(value) => setFilters((state) => ({ ...state, sourceId: value || undefined }))} value={filters.sourceId ?? ""} />
          <div className="col-span-2 mt-1 rounded border border-slate-700/80 bg-slate-800/50 p-2">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">{t("history.areaFilter")}</p>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput ariaLabel="North" label={t("history.north")} onChange={(value) => setBoundingBoxField("north", value)} step="any" type="number" value={filters.boundingBox?.north ?? ""} />
              <LabeledInput ariaLabel="South" label={t("history.south")} onChange={(value) => setBoundingBoxField("south", value)} step="any" type="number" value={filters.boundingBox?.south ?? ""} />
              <LabeledInput ariaLabel="East" label={t("history.east")} onChange={(value) => setBoundingBoxField("east", value)} step="any" type="number" value={filters.boundingBox?.east ?? ""} />
              <LabeledInput ariaLabel="West" label={t("history.west")} onChange={(value) => setBoundingBoxField("west", value)} step="any" type="number" value={filters.boundingBox?.west ?? ""} />
            </div>
          </div>
          <div className="col-span-2 mt-1">
            <button
              className="w-full rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              disabled={isSearching}
              type="submit"
            >
              {isSearching ? t("search.searching") : t("history.search")}
            </button>
          </div>
        </form>
      ) : null}

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
                    ? t("ship.search.noResults")
                    : t("ship.search.resultSummary", { count: results.length })}
                </span>
              </div>
            ) : null}
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">{t("ship.search.empty")}</p>
            ) : (
              <ul aria-label="Ship search results" className="flex flex-col divide-y divide-slate-700/50">
                {results.map((ship) => (
                  <li key={ship.mmsi}>
                    <div className={`px-4 py-3 ${selectedMmsi === ship.mmsi ? "bg-slate-700/80" : "hover:bg-slate-700/60"}`}>
                      <button
                        className="w-full text-left"
                        onClick={() => handleClick(ship)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-teal-300">{ship.mmsi}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              mode === "history"
                                ? "border border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                                : "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            }`}>
                              {mode === "history" ? t("ship.search.badge.history") : t("ship.search.badge.live")}
                            </span>
                            {ship.vesselType ? <span className="text-[10px] text-slate-400">{ship.vesselType}</span> : null}
                          </div>
                        </div>
                        {ship.vesselName ?? ship.callSign ?? ship.destination ? (
                          <div className="mt-1 flex gap-2 text-[11px] text-slate-300">
                            {ship.vesselName ? <span className="font-medium text-slate-200">{ship.vesselName}</span> : null}
                            {ship.callSign ? <span className="text-slate-400">{ship.callSign}</span> : null}
                            {ship.destination ? <span className="truncate text-slate-500">{ship.destination}</span> : null}
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
                          {ship.imo ? <span>IMO {ship.imo}</span> : null}
                          {ship.sourceId ? <span>{ship.sourceId}</span> : null}
                          {ship.speed != null ? <span>{Math.round(ship.speed)} kts</span> : null}
                          <span>{new Date(ship.eventTime).toLocaleTimeString()}</span>
                          {trackedMmsis[ship.mmsi] ? <span>{t("ship.tracked")}</span> : null}
                        </div>
                      </button>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="rounded-full border border-slate-600 px-2.5 py-1 text-[10px] font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
                          onClick={() => handleClick(ship)}
                          type="button"
                        >
                          {t("ship.search.focus")}
                        </button>
                        <button
                          className="rounded-full border border-cyan-500/60 px-2.5 py-1 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-500/10"
                          onClick={() => handleOpenDetails(ship)}
                          type="button"
                        >
                          {t("ship.popup.viewDetails")}
                        </button>
                        <ShipTrackGroupPicker compact mmsi={ship.mmsi} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {showViewportHint ? (
          <div className="mt-8 px-4 text-center">
            <p className="text-xs text-slate-500">{t("ship.search.viewportHint")}</p>
          </div>
        ) : null}

        {showGlobalHint ? (
          <div className="mt-8 px-4 text-center">
            <p className="text-xs text-slate-500">{t("ship.search.globalHint")}</p>
          </div>
        ) : null}

        {showHistoryHint ? (
          <div className="mt-8 px-4 text-center">
            <p className="text-xs text-slate-500">{t("ship.search.historyHint")}</p>
          </div>
        ) : null}
      </div>
    </OverlayPanel>
  );
}

type LabeledInputProps = {
  label: string;
  ariaLabel: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  step?: string;
  className?: string;
};

function LabeledInput({
  label,
  ariaLabel,
  value,
  onChange,
  type = "text",
  min,
  step,
  className,
}: LabeledInputProps): JSX.Element {
  return (
    <div className={className}>
      <label className="block text-[10px] text-slate-400">{label}</label>
      <input
        aria-label={ariaLabel}
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={step}
        type={type}
        value={value}
      />
    </div>
  );
}
