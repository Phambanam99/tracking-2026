import { useState, useCallback } from "react";
import { list } from "../providers/registry";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { AddProviderDialog } from "./AddProviderDialog";

/**
 * MapToolbar – top bar inside the map viewport.
 *
 * Shows map provider switcher buttons and a "+" button
 * to add custom WMS providers (e.g. GeoServer).
 */
export type MapToolbarProps = {
  /** Optional flight / vessel count to display in the toolbar. */
  trackedCount?: number;
  /** Active map provider id so the toolbar can expose the foundation map switcher. */
  activeProviderId?: string;
  /** Callback for switching between available providers. */
  onProviderChange?: (providerId: string) => void;
};

export function MapToolbar({
  trackedCount,
  activeProviderId,
  onProviderChange,
}: MapToolbarProps): JSX.Element {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const providers = list();
  const selectedProviderId = activeProviderId ?? providers[0]?.id;

  function getProviderLabel(fallbackName: string, labelKey?: string): string {
    if (!labelKey) {
      return fallbackName;
    }
    const translated = t(labelKey);
    return translated === labelKey ? fallbackName : translated;
  }

  const handleProviderAdded = useCallback((providerId: string) => {
    setRefreshKey((k) => k + 1);
    onProviderChange?.(providerId);
  }, [onProviderChange]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200">Live Map</span>
          <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 p-1" data-refresh={refreshKey}>
            {providers.map((provider) => (
              <BaseLayerButton
                key={provider.id}
                isActive={selectedProviderId === provider.id}
                label={getProviderLabel(provider.name, provider.labelKey)}
                onClick={() => onProviderChange?.(provider.id)}
              />
            ))}
            <button
              type="button"
              className="flex items-center justify-center rounded-full w-6 h-6 text-slate-400 hover:bg-slate-800 hover:text-sky-400 transition-colors text-xs font-bold"
              onClick={() => setDialogOpen(true)}
              title={t("map.customProvider.title")}
              aria-label={t("map.customProvider.title")}
            >
              +
            </button>
          </div>
        </div>
        {trackedCount != null && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {trackedCount} tracked
          </span>
        )}
      </div>
      <AddProviderDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setRefreshKey((k) => k + 1); }}
        onProviderAdded={handleProviderAdded}
      />
    </>
  );
}

type BaseLayerButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function BaseLayerButton({ label, isActive, onClick }: BaseLayerButtonProps): JSX.Element {
  return (
    <button
      aria-pressed={isActive}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${isActive
          ? "bg-sky-400 text-slate-950"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
