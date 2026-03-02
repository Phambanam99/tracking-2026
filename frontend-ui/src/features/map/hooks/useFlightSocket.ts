import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { useEffect, useMemo, useRef } from "react";
import type { BoundingBox, SocketFlight } from "../render/flightLayer";

export type LiveFlightMessage = {
  sent_at: number;
  flight: SocketFlight;
};

export type FlightSocketHandlers = {
  onMessage: (message: LiveFlightMessage) => void;
  onError?: (error: string) => void;
};

export type FlightSocketSession = {
  updateViewport: (viewport: BoundingBox) => void;
  disconnect: () => void;
};

type StompClientFactory = (params: { brokerURL: string; token: string; handlers: FlightSocketHandlers }) => StompLikeClient;

export type StompLikeClient = {
  activate: () => void;
  deactivate: () => Promise<void> | void;
  publish: (args: { destination: string; body: string }) => void;
  subscribe: (destination: string, callback: (message: { body: string }) => void) => StompSubscriptionLike;
  setOnConnect: (callback: () => void) => void;
  setOnStompError: (callback: (frame: { headers?: Record<string, string> }) => void) => void;
};

export type StompSubscriptionLike = {
  unsubscribe: () => void;
};

export type ConnectFlightSocketOptions = {
  token: string;
  viewport: BoundingBox;
  handlers: FlightSocketHandlers;
  brokerUrl?: string;
  /** Debounce delay in ms for viewport publish; defaults to 300ms. */
  viewportDebounceMs?: number;
  clientFactory?: StompClientFactory;
};

/** Debounce viewport delay — avoids spamming the server on rapid pan/zoom. */
const DEFAULT_VIEWPORT_DEBOUNCE_MS = 300;

export function connectFlightSocket(options: ConnectFlightSocketOptions): FlightSocketSession {
  const brokerURL = withAccessTokenQuery(options.brokerUrl ?? resolveBrokerUrl(), options.token);
  const clientFactory = options.clientFactory ?? defaultStompClientFactory;
  const client = clientFactory({
    brokerURL,
    token: options.token,
    handlers: options.handlers,
  });

  const debounceMs = options.viewportDebounceMs ?? DEFAULT_VIEWPORT_DEBOUNCE_MS;

  let subscription: StompSubscriptionLike | null = null;
  let queuedViewport = options.viewport;
  let connected = false;
  // BUG-1 FIX / PERF-2 FIX: debounce viewport publish so rapid pan/zoom
  // events don't flood the STOMP broker with messages.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const publishViewportNow = (): void => {
    if (!connected) {
      return;
    }
    try {
      client.publish({
        destination: "/app/viewport",
        body: JSON.stringify(queuedViewport),
      });
    } catch {
      options.handlers.onError?.("WebSocket transport error");
    }
  };

  const publishViewport = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      publishViewportNow();
    }, debounceMs);
  };

  // On initial connect we publish immediately (no debounce) so the server
  // sends data for the current viewport right away.
  const publishViewportImmediate = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    publishViewportNow();
  };

  client.setOnConnect(() => {
    connected = true;
    subscription = client.subscribe("/user/topic/flights", (message) => {
      const payload = safeParseMessage(message.body);
      if (payload) {
        options.handlers.onMessage(payload);
      }
    });
    // Publish immediately on connect — no debounce needed here.
    publishViewportImmediate();
  });

  client.setOnStompError((frame) => {
    options.handlers.onError?.(frame.headers?.message ?? "STOMP error");
  });

  client.activate();

  return {
    updateViewport: (nextViewport: BoundingBox) => {
      queuedViewport = nextViewport;
      // Debounced: server is notified after the user finishes panning/zooming.
      publishViewport();
    },
    disconnect: () => {
      connected = false;
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      subscription?.unsubscribe();
      void client.deactivate();
    },
  };
}

/**
 * React hook that manages the lifecycle of a STOMP flight socket.
 *
 * @param token   JWT access token; passing null disconnects the socket.
 * @param viewport Current map bounding box. **Must be stable** (wrap in useMemo
 *   with primitive deps) to avoid unnecessary viewport publishes. The viewport is
 *   sent to the server with a 300 ms debounce so rapid pan/zoom events do not
 *   flood the broker.
 * @param handlers Message/error callbacks. **Must be stable** (wrap in useMemo
 *   or useRef) — a new object reference causes the socket to reconnect.
 */
export function useFlightSocket(
  token: string | null,
  viewport: BoundingBox,
  handlers: FlightSocketHandlers,
): void {
  const sessionRef = useRef<FlightSocketSession | null>(null);

  // BUG-1 FIX: normalise viewport to a stable object so that identity changes
  // on the calling component (e.g. rawViewport ?? DEFAULT_VIEWPORT producing a
  // new reference) do NOT trigger a reconnect — only actual value changes do.
  const stableViewport = useMemo(
    () => viewport,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport.east, viewport.north, viewport.south, viewport.west],
  );

  useEffect(() => {
    if (!token) {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      return undefined;
    }

    sessionRef.current = connectFlightSocket({
      token,
      viewport: stableViewport,
      handlers,
    });

    return () => {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
    // handlers MUST be stable (useMemo/useRef) at the call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers, token]);

  useEffect(() => {
    sessionRef.current?.updateViewport(stableViewport);
  }, [stableViewport]);
}

function defaultStompClientFactory(params: {
  brokerURL: string;
  token: string;
  handlers: FlightSocketHandlers;
}): StompLikeClient {
  const client = new Client({
    brokerURL: params.brokerURL,
    reconnectDelay: 2000,
    connectHeaders: {
      Authorization: `Bearer ${params.token}`,
    },
    onWebSocketError: () => {
      params.handlers.onError?.("WebSocket transport error");
    },
  });

  return {
    activate: () => client.activate(),
    deactivate: () => client.deactivate(),
    publish: (args) => client.publish(args),
    subscribe: (destination, callback) =>
      client.subscribe(destination, (message: IMessage) => {
        callback({ body: message.body });
      }),
    setOnConnect: (callback) => {
      client.onConnect = callback;
    },
    setOnStompError: (callback) => {
      client.onStompError = (frame) => {
        callback({
          headers: frame.headers,
        });
      };
    },
  };
}

function safeParseMessage(payload: string): LiveFlightMessage | null {
  try {
    return JSON.parse(payload) as LiveFlightMessage;
  } catch {
    return null;
  }
}

function resolveBrokerUrl(): string {
  const configured = import.meta.env.VITE_GATEWAY_WS_URL;
  if (configured) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host || "localhost:5173";
  return `${protocol}://${host}/ws/live`;
}

function withAccessTokenQuery(brokerUrl: string, token: string): string {
  if (brokerUrl.includes("access_token=")) {
    return brokerUrl;
  }

  const separator = brokerUrl.includes("?") ? "&" : "?";
  return `${brokerUrl}${separator}access_token=${encodeURIComponent(token)}`;
}
