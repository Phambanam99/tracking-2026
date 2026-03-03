import { useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { OverlayPanel } from "../../../shared/components/OverlayPanel";
import { useWatchlistStore } from "../store/useWatchlistStore";
import { CreateGroupInline } from "./CreateGroupInline";
import { WatchlistGroupCard } from "./WatchlistGroupCard";

type WatchlistPanelProps = {
  onClose: () => void;
  placement?: "left" | "right";
  dockClassName?: string;
  animationClassName?: string;
  enableSwipeClose?: boolean;
};

export function WatchlistPanel({
  onClose,
  placement = "right",
  dockClassName,
  animationClassName,
  enableSwipeClose = false,
}: WatchlistPanelProps): JSX.Element {
  const { t } = useI18n();
  const groups = useWatchlistStore((state) => state.groups);
  const isLoading = useWatchlistStore((state) => state.loading);
  const error = useWatchlistStore((state) => state.error);
  const [showCreate, setShowCreate] = useState(false);
  const edgeClassName = placement === "left" ? "left-4" : "right-4";

  return (
    <OverlayPanel
      ariaLabel="Watchlist panel"
      animationClassName={animationClassName}
      closeLabel={t("watchlist.close")}
      description={t("watchlist.description")}
      dockClassName={dockClassName ?? edgeClassName}
      enableSwipeClose={enableSwipeClose}
      footer={
        groups.length > 0 ? (
          <p className="text-[10px] text-slate-500">
            {t("watchlist.footer", {
              groups: groups.length,
              aircraft: groups.reduce((sum, group) => sum + (group.entries?.length ?? group.entryCount), 0),
            })}
          </p>
        ) : null
      }
      onClose={onClose}
      title={t("watchlist.title")}
    >
      <div className="flex items-center justify-end px-4 pt-3">
        <button
          aria-label="Create new group"
          className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
          onClick={() => setShowCreate((value) => !value)}
          type="button"
        >
          {t("watchlist.createGroup")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {showCreate ? (
          <div className="mb-3">
            <CreateGroupInline onDone={() => setShowCreate(false)} />
          </div>
        ) : null}

        {isLoading ? <p className="text-center text-xs text-slate-500">Loading…</p> : null}

        {!isLoading && error ? (
          <p className="rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</p>
        ) : null}

        {!isLoading && !error && groups.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">{t("watchlist.empty")}</p>
            <p className="mt-1 text-xs text-slate-500">{t("watchlist.emptyDescription")}</p>
          </div>
        ) : null}

        {groups.length > 0 ? (
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <WatchlistGroupCard group={group} key={group.id} />
            ))}
          </div>
        ) : null}
      </div>
    </OverlayPanel>
  );
}
