import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useWatchlistStore } from "../store/useWatchlistStore";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

type CreateGroupInlineProps = {
  onDone: () => void;
};

export function CreateGroupInline({ onDone }: CreateGroupInlineProps): JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createGroup = useWatchlistStore((state) => state.createGroup);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createGroup(trimmed, color);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("watchlist.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      aria-label="Create watchlist group"
      className="rounded-md border border-slate-600 bg-slate-700/60 p-3"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="mb-2 text-xs font-semibold text-slate-300">{t("watchlist.newGroup")}</p>

      <input
        autoFocus
        className="mb-2 w-full rounded border border-slate-500 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("watchlist.groupName")}
        type="text"
        value={name}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            aria-label={`Color ${c}`}
            className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c ? "border-white" : "border-transparent"
            }`}
            key={c}
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            type="button"
          />
        ))}
      </div>

      {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          disabled={submitting || !name.trim()}
          type="submit"
        >
          {submitting ? t("watchlist.saving") : t("watchlist.save")}
        </button>
        <button
          className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
          onClick={onDone}
          type="button"
        >
          {t("watchlist.cancel")}
        </button>
      </div>
    </form>
  );
}
