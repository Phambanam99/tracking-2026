import { useI18n } from "../../../shared/i18n/I18nProvider";

const ALTITUDE_BANDS = [
  { labelKey: "legend.ground", color: "#808080" },
  { label: "< 1,000 ft", color: "#00ff00" },
  { label: "< 5,000 ft", color: "#00dd88" },
  { label: "< 10,000 ft", color: "#00bbff" },
  { label: "< 20,000 ft", color: "#0055ff" },
  { label: "< 30,000 ft", color: "#aa00ff" },
  { label: ">= 30,000 ft", color: "#ff00aa" },
];

export function AltitudeLegend(): JSX.Element {
  const { t } = useI18n();

  return (
    <aside className="glass-panel pointer-events-none absolute bottom-4 left-4 z-30 hidden w-[320px] rounded-[22px] px-3 py-2.5 shadow-xl md:block">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/75">{t("legend.altitude")}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>{t("legend.ground")}</span>
          <span>{t("legend.high")}</span>
        </div>
      </div>

      <div className="mt-2 overflow-hidden rounded-full border border-slate-700/80 bg-slate-950/70">
        <div className="flex h-3 w-full">
          {ALTITUDE_BANDS.map((band) => (
            <span
              aria-label={"labelKey" in band ? t(band.labelKey) : band.label}
              className="h-full flex-1"
              key={"labelKey" in band ? band.labelKey : band.label}
              style={{ backgroundColor: band.color }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{t("legend.lt1k")}</span>
        <span>{t("legend.lt10k")}</span>
        <span>{t("legend.lt20k")}</span>
        <span>{t("legend.lt30k")}</span>
        <span>{t("legend.high")}</span>
      </div>
    </aside>
  );
}
