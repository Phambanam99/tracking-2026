import { useI18n } from "../../../shared/i18n/I18nProvider";

type PlaybackZoomSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function PlaybackZoomSlider({ value, onChange }: PlaybackZoomSliderProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{t("playback.zoomTimeline")}</span>
        <span className="font-semibold text-cyan-200">{value.toFixed(1)}x</span>
      </div>
      <input
        aria-label="Playback timeline zoom"
        className="w-full accent-cyan-500"
        max={4}
        min={0.5}
        onChange={(event) => onChange(Number(event.target.value))}
        step={0.1}
        type="range"
        value={value}
      />
    </div>
  );
}
