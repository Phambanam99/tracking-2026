import { useState } from "react";
import { fetchFlightHistory } from "../api/aircraftHistoryApi";
import { useAircraftStore } from "../store/useAircraftStore";

export type UseFlightHistoryResult = {
  isLoading: boolean;
  error: string | null;
  loadTrail: (icao: string, hoursBack: number) => Promise<void>;
};

export function useFlightHistory(): UseFlightHistoryResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTrail = useAircraftStore((state) => state.setTrail);

  async function loadTrail(icao: string, hoursBack: number): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const toMs = Date.now();
      const fromMs = toMs - hoursBack * 3_600_000;
      const positions = await fetchFlightHistory(icao, fromMs, toMs);
      setTrail(icao, positions);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load trail");
    } finally {
      setIsLoading(false);
    }
  }

  return { isLoading, error, loadTrail };
}
