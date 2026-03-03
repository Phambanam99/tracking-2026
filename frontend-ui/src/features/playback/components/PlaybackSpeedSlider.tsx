import { useI18n } from "../../../shared/i18n/I18nProvider";

const SPEED_MIN = 1;
const SPEED_MAX = 1000;

type PlaybackSpeedSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function PlaybackSpeedSlider({ value, onChange }: PlaybackSpeedSliderProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="flex min-w-[150px] flex-col gap-1">
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{t("playback.speed")}</span>
        <span className="font-semibold text-cyan-200">{t("playback.speedMultiplier", { speed: value })}</span>
      </div>
      <input
        aria-label="Playback speed"
        className="w-full accent-sky-500"
        max={SPEED_MAX}
        min={SPEED_MIN}
        onChange={(event) => onChange(Number(event.target.value))}
        step={1}
        type="range"
        value={value}
      />
    </div>
  );
}
