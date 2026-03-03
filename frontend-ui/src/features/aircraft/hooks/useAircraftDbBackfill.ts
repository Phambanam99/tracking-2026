import { useEffect } from "react";
import { loadAircraftDbEntry } from "../db/aircraftDb";
import { useAircraftStore } from "../store/useAircraftStore";

export function useAircraftDbBackfill(icao: string | null | undefined): void {
  const aircraft = useAircraftStore((state) => (icao ? state.aircraft[icao] : null));
  const upsertAircraft = useAircraftStore((state) => state.upsertAircraft);

  useEffect(() => {
    if (!icao || !aircraft) {
      return;
    }

    if (
      aircraft.registration
      && aircraft.aircraftType
      && aircraft.operator
      && aircraft.countryCode
      && aircraft.countryFlagUrl
    ) {
      return;
    }

    let cancelled = false;

    void loadAircraftDbEntry(icao).then((entry) => {
      if (cancelled || !entry) {
        return;
      }

      const current = useAircraftStore.getState().aircraft[icao];
      if (!current) {
        return;
      }

      const next = {
        ...current,
        registration: current.registration ?? entry.registration ?? null,
        aircraftType: current.aircraftType ?? entry.aircraftType ?? null,
        operator: current.operator ?? entry.operator ?? null,
        countryCode: current.countryCode ?? entry.countryCode ?? null,
        countryFlagUrl: current.countryFlagUrl ?? entry.countryFlagUrl ?? null,
      };

      if (
        next.registration !== current.registration
        || next.aircraftType !== current.aircraftType
        || next.operator !== current.operator
        || next.countryCode !== current.countryCode
        || next.countryFlagUrl !== current.countryFlagUrl
      ) {
        upsertAircraft(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    aircraft,
    aircraft?.aircraftType,
    aircraft?.countryCode,
    aircraft?.countryFlagUrl,
    aircraft?.operator,
    aircraft?.registration,
    icao,
    upsertAircraft,
  ]);
}
