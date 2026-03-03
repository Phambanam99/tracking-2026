import { useLayoutEffect, useRef, useState } from "react";
import { fromLonLat } from "ol/proj";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "../../auth/store/useAuthStore";
import {
  getCurrentPlaybackFrame,
  getPlaybackAircraftByIcao,
  usePlaybackStore,
} from "../../playback/store/usePlaybackStore";
import { AddToWatchlistDropdown } from "../../watchlist/components/AddToWatchlistDropdown";
import { useWatchlistStore } from "../../watchlist/store/useWatchlistStore";
import { useMapContext } from "../../map/context/MapContext";
import { useAircraftDbBackfill } from "../hooks/useAircraftDbBackfill";
import { useFlightHistory } from "../hooks/useFlightHistory";
import { useAircraftStore } from "../store/useAircraftStore";
import type { Aircraft } from "../types/aircraftTypes";
import { getCountryName } from "../utils/countryDisplay";
import { useI18n } from "../../../shared/i18n/I18nProvider";

const DEFAULT_FOLLOW_GROUP_NAME = "Default";
const DEFAULT_FOLLOW_GROUP_COLOR = "#3b82f6";

function formatAlt(ft: number | null | undefined, groundLabel: string): string {
  if (ft == null) return "-";
  if (ft <= 0) return groundLabel;
  return `${ft.toLocaleString()} ft`;
}

function formatSpeed(kts: number | null | undefined): string {
  if (kts == null) return "-";
  return `${Math.round(kts)} kts`;
}

function formatHeading(deg: number | null | undefined): string {
  if (deg == null) return "-";
  return `${Math.round(deg)} deg`;
}

function formatCoordinate(value: number, positiveSuffix: string, negativeSuffix: string): string {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positiveSuffix : negativeSuffix}`;
}

function formatPlaybackTimestamp(timestamp: number | null, locale: string): string {
  if (timestamp == null) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function CountryBadge({
  countryCode,
  countryFlagUrl,
  globeLabel,
  countryFlagLabel,
}: {
  countryCode: string | null | undefined;
  countryFlagUrl?: string | null | undefined;
  globeLabel: string;
  countryFlagLabel: string;
}): JSX.Element {
  const name = getCountryName(countryCode);
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? null;

  if (normalizedCountryCode) {
    const flagUrl = countryFlagUrl ?? `https://flagcdn.com/h80/${normalizedCountryCode.toLowerCase()}.png`;
    return (
      <img
        alt={`${normalizedCountryCode} ${countryFlagLabel}`}
        className="h-4 w-6 rounded-sm object-cover"
        loading="lazy"
        src={flagUrl}
      />
    );
  }

  if (name) {
    return <span className="text-xs text-slate-300">{name}</span>;
  }

  return <span className="text-xs text-slate-500">{globeLabel}</span>;
}

function MilitaryBadge({ label }: { label: string }): JSX.Element {
  return (
    <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
      {label}
    </span>
  );
}

type PopupContentProps = {
  aircraft: Aircraft;
  onClose: () => void;
  onShowDetails: () => void;
  onFocusPlaybackAircraft: () => void;
  trailCount: number;
  trailActive: boolean;
  onClearTrail: () => void;
  onLoadTrail: (hoursBack: number) => void;
  isTrailLoading: boolean;
  trailError: string | null;
  playbackFrameIndex: number | null;
  playbackFrameCount: number;
  playbackTimestamp: number | null;
  isPlaybackSnapshot: boolean;
};

const TRAIL_MAX_HOURS = 168;

function PopupContent({
  aircraft,
  onClose,
  onShowDetails,
  onFocusPlaybackAircraft,
  trailCount,
  trailActive,
  onClearTrail,
  onLoadTrail,
  isTrailLoading,
  trailError,
  playbackFrameIndex,
  playbackFrameCount,
  playbackTimestamp,
  isPlaybackSnapshot,
}: PopupContentProps): JSX.Element {
  const { locale, t } = useI18n();
  const [customHours, setCustomHours] = useState<string>("1");
  const parsedHours = Math.min(TRAIL_MAX_HOURS, Math.max(1, Math.round(Number(customHours) || 1)));
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const groups = useWatchlistStore((state) => state.groups);
  const createGroup = useWatchlistStore((state) => state.createGroup);
  const addAircraft = useWatchlistStore((state) => state.addAircraft);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followMessage, setFollowMessage] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const normalizedIcao = aircraft.icao.toLowerCase();
  const position = `${formatCoordinate(aircraft.lat, "N", "S")} ${formatCoordinate(aircraft.lon, "E", "W")}`;
  const headerTitle = aircraft.registration ?? aircraft.callsign ?? aircraft.icao;
  const headerSubtitle = aircraft.operator ?? getCountryName(aircraft.countryCode) ?? t("aircraft.unknownOperator");
  const isAlreadyInDefault = groups.some(
    (group) =>
      group.name === DEFAULT_FOLLOW_GROUP_NAME &&
      group.entries?.some((entry) => entry.icao.toLowerCase() === normalizedIcao),
  );

  async function handleFollow(): Promise<void> {
    setIsFollowing(true);
    setFollowError(null);
    setFollowMessage(null);

    try {
      let defaultGroup = groups.find((group) => group.name === DEFAULT_FOLLOW_GROUP_NAME);
      if (!defaultGroup) {
        defaultGroup = await createGroup(DEFAULT_FOLLOW_GROUP_NAME, DEFAULT_FOLLOW_GROUP_COLOR);
      }

      const alreadyTracked = defaultGroup.entries?.some(
        (entry) => entry.icao.toLowerCase() === normalizedIcao,
      );

      if (!alreadyTracked) {
        await addAircraft(defaultGroup.id, normalizedIcao);
      }

      setFollowMessage(t("aircraft.popup.followingInDefault"));
    } catch (error) {
      setFollowError(error instanceof Error ? error.message : t("aircraft.popup.followFailed"));
    } finally {
      setIsFollowing(false);
    }
  }

  return (
    <div className="glass-panel relative min-w-[250px] rounded-[22px] p-3.5 text-sm text-slate-100 shadow-glass">
      <button
        aria-label={t("aircraft.popup.close")}
        className="absolute right-2 top-2 text-slate-400 hover:text-white"
        onClick={onClose}
        type="button"
      >
        x
      </button>

      <div className="mb-3 flex items-start gap-3 border-b border-slate-700/80 pb-3 pr-6">
        <CountryBadge
          countryCode={aircraft.countryCode}
          countryFlagUrl={aircraft.countryFlagUrl}
          countryFlagLabel={t("aircraft.popup.countryFlag")}
          globeLabel={t("aircraft.globe")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{headerTitle}</span>
            {aircraft.isMilitary ? <MilitaryBadge label={t("aircraft.military")} /> : null}
          </div>
          <p className="mt-1 text-xs text-slate-300">{headerSubtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span className="rounded border border-slate-600 px-2 py-0.5 font-mono">
              {t("aircraft.field.icao")} {aircraft.icao.toUpperCase()}
            </span>
            {aircraft.callsign ? (
              <span className="rounded border border-slate-600 px-2 py-0.5">
                {t("aircraft.field.callsign")} {aircraft.callsign}
              </span>
            ) : null}
            {aircraft.aircraftType ? (
              <span className="rounded border border-slate-600 px-2 py-0.5">
                {t("aircraft.field.type")} {aircraft.aircraftType}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <table className="w-full text-xs">
        <tbody>
          {aircraft.registration ? (
            <tr>
              <td className="pr-2 text-slate-400">{t("aircraft.field.registrationShort")}</td>
              <td>{aircraft.registration}</td>
            </tr>
          ) : null}
          {aircraft.aircraftType ? (
            <tr>
              <td className="pr-2 text-slate-400">{t("aircraft.field.type")}</td>
              <td>{aircraft.aircraftType}</td>
            </tr>
          ) : null}
          {aircraft.operator ? (
            <tr>
              <td className="pr-2 text-slate-400">{t("aircraft.field.operator")}</td>
              <td>{aircraft.operator}</td>
            </tr>
          ) : null}
          {(aircraft.countryCode || aircraft.countryFlagUrl) ? (
            <tr>
              <td className="pr-2 text-slate-400">{t("aircraft.field.country")}</td>
              <td>
                <div className="flex items-center gap-2">
                  <CountryBadge
                    countryCode={aircraft.countryCode}
                    countryFlagUrl={aircraft.countryFlagUrl}
                    countryFlagLabel={t("aircraft.popup.countryFlag")}
                    globeLabel={t("aircraft.globe")}
                  />
                  <span>{getCountryName(aircraft.countryCode) ?? aircraft.countryCode ?? "-"}</span>
                  {aircraft.countryCode ? <span>{aircraft.countryCode}</span> : null}
                </div>
              </td>
            </tr>
          ) : null}
          {aircraft.isMilitary ? (
            <tr>
              <td className="pr-2 text-slate-400">{t("aircraft.field.class")}</td>
              <td>
                <MilitaryBadge label={t("aircraft.military")} />
              </td>
            </tr>
          ) : null}
          <tr>
            <td className="pr-2 text-slate-400">{t("aircraft.field.icao")}</td>
            <td className="font-mono">{aircraft.icao.toUpperCase()}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">{t("aircraft.field.altitude")}</td>
            <td>{formatAlt(aircraft.altitude, t("aircraft.ground"))}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">{t("aircraft.field.speed")}</td>
            <td>{formatSpeed(aircraft.speed)}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">{t("aircraft.field.heading")}</td>
            <td>{formatHeading(aircraft.heading)}</td>
          </tr>
          <tr>
            <td className="pr-2 text-slate-400">{t("aircraft.field.position")}</td>
            <td>{position}</td>
          </tr>
        </tbody>
      </table>

      {isPlaybackSnapshot ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
            {t("aircraft.popup.playbackSnapshot")}
          </div>
          <div className="space-y-1 text-xs text-slate-200">
            <div>
              <span className="text-slate-400">{t("aircraft.popup.frame")}</span>{" "}
              {playbackFrameIndex == null ? "-" : playbackFrameIndex + 1} / {playbackFrameCount}
            </div>
            <div>
              <span className="text-slate-400">{t("aircraft.popup.timestamp")}</span>{" "}
              {formatPlaybackTimestamp(playbackTimestamp, locale)}
            </div>
            <div>
              <span className="text-slate-400">{t("aircraft.popup.mode")}</span> {t("aircraft.popup.viewportPlayback")}
            </div>
          </div>
          <div className="mt-3">
            <button
              className="rounded border border-amber-400/50 px-3 py-1 text-xs text-amber-100 hover:bg-amber-400/10"
              onClick={onFocusPlaybackAircraft}
              type="button"
            >
              {t("aircraft.popup.focusOnMap")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-700/80 pt-3">
        {isAuthenticated ? (
          <div className="mb-3">
            <button
              className="rounded border border-emerald-500 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isFollowing || isAlreadyInDefault}
              onClick={() => void handleFollow()}
              type="button"
            >
              {isAlreadyInDefault
                ? t("aircraft.popup.following")
                : isFollowing
                  ? t("aircraft.popup.followingProgress")
                  : t("aircraft.popup.follow")}
            </button>
            {followMessage ? <p className="mt-2 text-xs text-emerald-300">{followMessage}</p> : null}
            {followError ? <p className="mt-2 text-xs text-rose-300">{followError}</p> : null}
          </div>
        ) : null}

        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t("aircraft.popup.flightTrail")}
        </div>

        <div className="flex items-center gap-2">
          <input
            aria-label={t("aircraft.popup.trailHours")}
            className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
            max={TRAIL_MAX_HOURS}
            min={1}
            onChange={(event) => setCustomHours(event.target.value)}
            placeholder={t("aircraft.popup.hoursPlaceholder")}
            type="number"
            value={customHours}
          />
          <span className="text-xs text-slate-400">{t("aircraft.popup.maxHours", { hours: TRAIL_MAX_HOURS })}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {trailActive ? (
            <button
              className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-100 hover:border-slate-400"
              onClick={onClearTrail}
              type="button"
            >
              {t("aircraft.popup.clearTrail", { count: trailCount })}
            </button>
          ) : (
            <button
              className="rounded border border-sky-500 px-3 py-1 text-xs text-sky-100 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isTrailLoading || parsedHours < 1}
              onClick={() => onLoadTrail(parsedHours)}
              type="button"
            >
              {isTrailLoading ? t("playback.loading") : t("aircraft.popup.showTrail", { hours: parsedHours })}
            </button>
          )}
        </div>
        {trailError ? <p className="mt-2 text-xs text-rose-300">{trailError}</p> : null}
      </div>

      <div className="mt-3 border-t border-slate-700/80 pt-3">
        <AddToWatchlistDropdown icao={aircraft.icao} />
      </div>

      <div className="mt-2">
        <button
          className="w-full rounded border border-cyan-500 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/10"
          onClick={onShowDetails}
          type="button"
        >
          {t("aircraft.popup.viewDetails")}
        </button>
      </div>
    </div>
  );
}

export function AircraftPopup(): JSX.Element {
  const { map, mapContainerEl } = useMapContext();
  const popupRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const { selectAircraft, showDetails, clearTrail, selectedIcao, trailIcao, trailCount, liveAircraft } =
    useAircraftStore(
      useShallow((state) => ({
        selectAircraft: state.selectAircraft,
        showDetails: state.showDetails,
        clearTrail: state.clearTrail,
        selectedIcao: state.selectedIcao,
        trailIcao: state.trailIcao,
        trailCount: state.trailPositions.length,
        liveAircraft: state.selectedIcao ? state.aircraft[state.selectedIcao] : null,
      })),
    );
  const { playbackIsOpen, playbackStatus, playbackFrameIndex, playbackFrameCount } = usePlaybackStore(
    useShallow((state) => ({
      playbackIsOpen: state.isOpen,
      playbackStatus: state.status,
      playbackFrameIndex: state.currentFrameIndex,
      playbackFrameCount: state.frames.length,
    })),
  );
  const playbackFrame = usePlaybackStore(getCurrentPlaybackFrame);
  const playbackAircraft = usePlaybackStore((state) => getPlaybackAircraftByIcao(state, selectedIcao));
  const { isLoading, error, loadTrail } = useFlightHistory();

  useAircraftDbBackfill(selectedIcao);
  const isPlaybackSnapshot = Boolean(
    playbackIsOpen && playbackStatus === "ready" && playbackFrame && playbackAircraft,
  );
  const isPlaybackActive = playbackIsOpen && playbackStatus === "ready";
  const aircraft = isPlaybackActive ? playbackAircraft : liveAircraft;

  const handleClose = (): void => {
    selectAircraft(null);
  };

  const handleShowDetails = (): void => {
    if (aircraft) {
      showDetails(aircraft.icao);
    }
  };

  useLayoutEffect(() => {
    const connectorEl = connectorRef.current;
    if (!connectorEl) {
      return;
    }

    if (!map || !mapContainerEl || !popupRef.current || !aircraft) {
      connectorEl.style.display = "none";
      return;
    }

    const updateLine = (): void => {
      if (!popupRef.current || !mapContainerEl || !connectorRef.current) {
        return;
      }

      const popupRect = popupRef.current.getBoundingClientRect();
      const mapRect = mapContainerEl.getBoundingClientRect();
      const pixel = map.getPixelFromCoordinate(fromLonLat([aircraft.lon, aircraft.lat]));
      if (!pixel) {
        connectorRef.current.style.display = "none";
        return;
      }

      connectorRef.current.setAttribute("x1", String(popupRect.right - mapRect.left));
      connectorRef.current.setAttribute("y1", String(popupRect.bottom - mapRect.top));
      connectorRef.current.setAttribute("x2", String(pixel[0]));
      connectorRef.current.setAttribute("y2", String(pixel[1]));
      connectorRef.current.style.display = "block";
    };

    updateLine();
    map.on("postrender", updateLine);
    window.addEventListener("resize", updateLine);

    return () => {
      map.un("postrender", updateLine);
      window.removeEventListener("resize", updateLine);
    };
  }, [aircraft, map, mapContainerEl]);

  const handleLoadTrail = (hoursBack: number): void => {
    if (!aircraft) {
      return;
    }
    void loadTrail(aircraft.icao, hoursBack);
  };

  const handleFocusPlaybackAircraft = (): void => {
    if (!map || !aircraft) {
      return;
    }

    const view = map.getView?.();
    if (!view) {
      return;
    }

    view.animate?.({
      center: fromLonLat([aircraft.lon, aircraft.lat]),
      zoom: Math.max(Number(view.getZoom?.() ?? 0), 8),
      duration: 500,
    });
  };

  const isVisible = Boolean(aircraft && mapContainerEl);
  const isTrailActive = trailIcao === aircraft?.icao && trailCount > 0;

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[19]"
        data-testid="aircraft-popup-connector"
      >
        <line
          ref={connectorRef}
          opacity="0.7"
          stroke="#38bdf8"
          strokeDasharray="6 4"
          strokeWidth="1.5"
          style={{ display: "none" }}
        />
      </svg>
      <div
        className="pointer-events-none absolute inset-0 z-20"
        data-testid="aircraft-popup"
      >
        {isVisible && aircraft ? (
          <div
            ref={popupRef}
            className="pointer-events-auto absolute left-3 top-12 max-h-[calc(100%-60px)] overflow-y-auto"
          >
            <PopupContent
              aircraft={aircraft}
              isTrailLoading={isLoading}
              isPlaybackSnapshot={isPlaybackSnapshot}
              onClearTrail={clearTrail}
              onClose={handleClose}
              onFocusPlaybackAircraft={handleFocusPlaybackAircraft}
              onLoadTrail={handleLoadTrail}
              onShowDetails={handleShowDetails}
              playbackFrameCount={playbackFrameCount}
              playbackFrameIndex={isPlaybackSnapshot ? playbackFrameIndex : null}
              playbackTimestamp={
                isPlaybackSnapshot ? playbackFrame?.timestamp ?? playbackAircraft?.eventTime ?? null : null
              }
              trailActive={isTrailActive}
              trailCount={trailCount}
              trailError={error}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
