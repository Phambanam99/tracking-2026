import { useEffect, useState } from "react";
import { useAuthStore } from "../../auth/store/useAuthStore";

type AircraftPhotoState = {
  imageUrl: string | null;
  isLoading: boolean;
  source: "local" | "planespotters" | null;
};

type PlanespottersResponse = {
  photos?: Array<{
    thumbnail?: { src?: string | null } | null;
    thumbnail_large?: { src?: string | null } | null;
  }>;
};

const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_HTTP_BASE ?? "";

export function useAircraftPhoto(icao: string | null | undefined): AircraftPhotoState {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [state, setState] = useState<AircraftPhotoState>({
    imageUrl: null,
    isLoading: false,
    source: null,
  });

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    if (!icao) {
      setState({ imageUrl: null, isLoading: false, source: null });
      return;
    }

    setState((current) => ({ ...current, isLoading: true }));

    void (async () => {
      const normalizedIcao = icao.trim().toUpperCase();
      const localPhoto = await fetchLocalPhoto(normalizedIcao, accessToken);
      if (!isCancelled && localPhoto) {
        objectUrl = localPhoto;
        setState({ imageUrl: localPhoto, isLoading: false, source: "local" });
        return;
      }

      const remotePhoto = await fetchPlanespottersPhoto(normalizedIcao);
      if (!isCancelled) {
        setState({
          imageUrl: remotePhoto,
          isLoading: false,
          source: remotePhoto ? "planespotters" : null,
        });
      }
    })();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [accessToken, icao]);

  return state;
}

async function fetchLocalPhoto(icao: string, accessToken: string | null): Promise<string | null> {
  const response = await fetch(resolveLocalPhotoUrl(icao), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: "include",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return null;
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function fetchPlanespottersPhoto(icao: string): Promise<string | null> {
  const response = await fetch(`https://api.planespotters.net/pub/photos/hex/${icao.toLowerCase()}`).catch(
    () => null,
  );
  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json()) as PlanespottersResponse;
  const firstPhoto = payload.photos?.[0];
  return firstPhoto?.thumbnail_large?.src ?? firstPhoto?.thumbnail?.src ?? null;
}

function resolveLocalPhotoUrl(icao: string): string {
  const path = `/api/v1/aircraft/${icao}/photo/local`;
  return GATEWAY_BASE_URL ? `${GATEWAY_BASE_URL}${path}` : path;
}
