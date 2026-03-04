import { useEffect, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { useTrackedShipStore } from "../store/useTrackedShipStore";

type ShipTrackGroupPickerProps = {
  mmsi: string;
  compact?: boolean;
};

export function ShipTrackGroupPicker({ mmsi, compact = false }: ShipTrackGroupPickerProps): JSX.Element {
  const { t } = useI18n();
  const groups = useTrackedShipStore((state) => state.groups);
  const activeGroupId = useTrackedShipStore((state) => state.activeGroupId);
  const toggleTrackedShip = useTrackedShipStore((state) => state.toggleTrackedShip);
  const getGroupsForShip = useTrackedShipStore((state) => state.getGroupsForShip);
  const [selectedGroupId, setSelectedGroupId] = useState(activeGroupId);

  useEffect(() => {
    setSelectedGroupId(activeGroupId);
  }, [activeGroupId]);

  const groupsForShip = getGroupsForShip(mmsi);
  const inSelectedGroup = groupsForShip.some((group) => group.id === selectedGroupId);
  const isTracked = groupsForShip.length > 0;
  const buttonLabel = inSelectedGroup
    ? t("ship.untrack")
    : isTracked
      ? t("ship.trackGroup.add")
      : t("ship.track");

  return (
    <div className={`flex ${compact ? "gap-1.5" : "gap-2"}`}>
      <select
        aria-label={t("ship.trackGroup.select")}
        className={`rounded border border-slate-700 bg-slate-900/80 text-slate-100 outline-none transition focus:border-yellow-300/70 ${
          compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-xs"
        }`}
        onChange={(event) => setSelectedGroupId(event.target.value)}
        value={selectedGroupId}
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <button
        className={`rounded border border-yellow-400/50 font-medium text-yellow-100 transition hover:bg-yellow-400/10 ${
          compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
        }`}
        onClick={() => toggleTrackedShip(mmsi, selectedGroupId)}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
