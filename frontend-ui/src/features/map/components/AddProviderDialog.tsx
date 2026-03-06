import { useState } from "react";
import { addCustomProvider, loadCustomProviders, removeCustomProvider } from "../providers/customProviderStorage";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MapTileProvider } from "../providers/types";

type AddProviderDialogProps = {
    open: boolean;
    onClose: () => void;
    onProviderAdded: (providerId: string) => void;
};

export function AddProviderDialog({ open, onClose, onProviderAdded }: AddProviderDialogProps): JSX.Element | null {
    const { t } = useI18n();

    const [name, setName] = useState("GeoServer");
    const [url, setUrl] = useState("");
    const [layers, setLayers] = useState("");
    const [error, setError] = useState("");

    const customProviders = loadCustomProviders();

    function handleSubmit(e: React.FormEvent): void {
        e.preventDefault();
        setError("");

        const trimmedUrl = url.trim();
        const trimmedLayers = layers.trim();
        const trimmedName = name.trim();

        if (!trimmedName) {
            setError(t("map.customProvider.errorName"));
            return;
        }

        if (!trimmedUrl) {
            setError(t("map.customProvider.errorUrl"));
            return;
        }

        if (!trimmedLayers) {
            setError(t("map.customProvider.errorLayers"));
            return;
        }

        const id = `custom-wms-${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

        const provider: MapTileProvider = {
            id,
            name: trimmedName,
            category: "custom",
            sourceType: "wms",
            url: trimmedUrl,
            wmsLayers: trimmedLayers,
            wmsVersion: "1.3.0",
            wmsFormat: "image/png",
            crossOrigin: "anonymous",
        };

        addCustomProvider(provider);
        onProviderAdded(id);
        setUrl("");
        setLayers("");
        setName("GeoServer");
        onClose();
    }

    function handleRemove(providerId: string): void {
        removeCustomProvider(providerId);
        onClose();
    }

    if (!open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-[420px] rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">{t("map.customProvider.title")}</h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                        type="button"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {customProviders.length > 0 && (
                    <div className="mb-4">
                        <div className="text-[11px] font-medium text-slate-400 uppercase mb-2">{t("map.customProvider.existing")}</div>
                        <div className="space-y-1">
                            {customProviders.map((p) => (
                                <div key={p.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-xs text-slate-300">
                                    <div>
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-slate-500 text-[10px] truncate max-w-[280px]">{p.url}</div>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(p.id)}
                                        className="text-red-400 hover:text-red-300 text-[10px] ml-2 shrink-0"
                                        type="button"
                                    >
                                        {t("map.customProvider.remove")}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="text-[11px] font-medium text-slate-400 uppercase">{t("map.customProvider.addNew")}</div>

                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">{t("map.customProvider.name")}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="GeoServer"
                            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">{t("map.customProvider.url")}</label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="http://localhost:8600/geoserver/tracking/wms"
                            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">{t("map.customProvider.layers")}</label>
                        <input
                            type="text"
                            value={layers}
                            onChange={(e) => setLayers(e.target.value)}
                            placeholder="tracking:basemap"
                            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                        />
                    </div>

                    {error && (
                        <div className="text-[11px] text-red-400">{error}</div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                        >
                            {t("map.customProvider.cancel")}
                        </button>
                        <button
                            type="submit"
                            className="rounded bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 transition-colors"
                        >
                            {t("map.customProvider.add")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
