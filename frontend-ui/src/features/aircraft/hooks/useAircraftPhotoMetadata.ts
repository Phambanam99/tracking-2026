import { useEffect, useState } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";

export type AircraftPhotoMetadata = {
  icao: string;
  cacheHit: boolean;
  sourceUrl: string | null;
  cachedAt: string | null;
  contentType: string | null;
  localPhotoUrl: string | null;
};

type AircraftPhotoMetadataState = {
  metadata: AircraftPhotoMetadata | null;
  isLoading: boolean;
};

const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_HTTP_BASE ?? "";

export function useAircraftPhotoMetadata(
  icao: string | null | undefined,
): AircraftPhotoMetadataState {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [state, setState] = useState<AircraftPhotoMetadataState>({
    metadata: null,
    isLoading: false,
  });

  useEffect(() => {
    let isCancelled = false;

    if (!icao) {
      setState({ metadata: null, isLoading: false });
      return;
    }

    const normalizedIcao = icao.trim().toUpperCase();
    setState((current) => ({ ...current, isLoading: true }));

    void (async () => {
      const response = await fetch(resolveMetadataUrl(normalizedIcao), {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      }).catch(() => null);

      if (isCancelled) {
        return;
      }

      if (!response?.ok) {
        setState({ metadata: null, isLoading: false });
        return;
      }

      const payload = (await response.json()) as AircraftPhotoMetadata;
      setState({ metadata: payload, isLoading: false });
    })();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, icao]);

  return state;
}

function resolveMetadataUrl(icao: string): string {
  const path = `/api/v1/aircraft/${icao}/photo/metadata`;
  return GATEWAY_BASE_URL ? `${GATEWAY_BASE_URL}${path}` : path;
}
