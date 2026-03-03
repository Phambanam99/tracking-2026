import { useI18n } from "../../../shared/i18n/I18nProvider";
import { searchHistory } from "../api/searchApi";
import { useSearchStore } from "../store/useSearchStore";
import type { SearchBoundingBox } from "../types/searchTypes";

export function AdvancedSearchForm(): JSX.Element {
  const { t } = useI18n();
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const setResults = useSearchStore((s) => s.setResults);
  const setSearching = useSearchStore((s) => s.setSearching);
  const setError = useSearchStore((s) => s.setError);
  const isSearching = useSearchStore((s) => s.isSearching);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    const { mode: _mode, ...historyFilters } = filters;
    searchHistory(historyFilters)
      .then((resp) => {
        setResults(resp.results);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("history.failed"));
      })
      .finally(() => {
        setSearching(false);
      });
  }

  function setBoundingBoxField(key: keyof SearchBoundingBox, value: string): void {
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
    setFilters({ boundingBox: hasAnyBounds ? nextBoundingBox as SearchBoundingBox : undefined });
  }

  return (
    <form className="grid grid-cols-2 gap-2 px-4 pb-3" onSubmit={handleSubmit}>
      <LabeledInput ariaLabel="ICAO Hex" label={t("history.icao")} onChange={(value) => setFilters({ icao: value || undefined })} placeholder="e.g. abc123" value={filters.icao ?? ""} />
      <LabeledInput ariaLabel="Callsign" label={t("history.callsign")} onChange={(value) => setFilters({ callsign: value || undefined })} placeholder="e.g. VN123" value={filters.callsign ?? ""} />
      <LabeledInput ariaLabel="Registration" label={t("history.registration")} onChange={(value) => setFilters({ registration: value || undefined })} placeholder="e.g. VN-A321" value={filters.registration ?? ""} />
      <LabeledInput ariaLabel="Aircraft Type" label={t("history.aircraftType")} onChange={(value) => setFilters({ aircraftType: value || undefined })} placeholder="e.g. A321" value={filters.aircraftType ?? ""} />
      <LabeledInput ariaLabel="From (UTC)" label={t("history.from")} onChange={(value) => setFilters({ timeFrom: value || undefined })} type="datetime-local" value={filters.timeFrom ?? ""} />
      <LabeledInput ariaLabel="To (UTC)" label={t("history.to")} onChange={(value) => setFilters({ timeTo: value || undefined })} type="datetime-local" value={filters.timeTo ?? ""} />
      <LabeledInput ariaLabel="Alt min (ft)" label={t("history.altMin")} min={0} onChange={(value) => setFilters({ altitudeMin: value ? Number(value) : undefined })} type="number" value={filters.altitudeMin ?? ""} />
      <LabeledInput ariaLabel="Alt max (ft)" label={t("history.altMax")} min={0} onChange={(value) => setFilters({ altitudeMax: value ? Number(value) : undefined })} type="number" value={filters.altitudeMax ?? ""} />
      <LabeledInput ariaLabel="Speed min (kts)" label={t("history.speedMin")} min={0} onChange={(value) => setFilters({ speedMin: value ? Number(value) : undefined })} type="number" value={filters.speedMin ?? ""} />
      <LabeledInput ariaLabel="Speed max (kts)" label={t("history.speedMax")} min={0} onChange={(value) => setFilters({ speedMax: value ? Number(value) : undefined })} type="number" value={filters.speedMax ?? ""} />
      <LabeledInput ariaLabel="Source" className="col-span-2" label={t("history.source")} onChange={(value) => setFilters({ sourceId: value || undefined })} placeholder="e.g. RADARBOX-GLOBAL" value={filters.sourceId ?? ""} />

      <div className="col-span-2 mt-1 rounded border border-slate-700/80 bg-slate-800/50 p-2">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">{t("history.areaFilter")}</p>
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput ariaLabel="North" label={t("history.north")} onChange={(value) => setBoundingBoxField("north", value)} placeholder="21.1" step="any" type="number" value={filters.boundingBox?.north ?? ""} />
          <LabeledInput ariaLabel="South" label={t("history.south")} onChange={(value) => setBoundingBoxField("south", value)} placeholder="20.9" step="any" type="number" value={filters.boundingBox?.south ?? ""} />
          <LabeledInput ariaLabel="East" label={t("history.east")} onChange={(value) => setBoundingBoxField("east", value)} placeholder="105.9" step="any" type="number" value={filters.boundingBox?.east ?? ""} />
          <LabeledInput ariaLabel="West" label={t("history.west")} onChange={(value) => setBoundingBoxField("west", value)} placeholder="105.7" step="any" type="number" value={filters.boundingBox?.west ?? ""} />
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
  );
}

type LabeledInputProps = {
  label: string;
  ariaLabel: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
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
  placeholder,
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        type={type}
        value={value}
      />
    </div>
  );
}
