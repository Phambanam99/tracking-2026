import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { useEffect, useMemo, useRef } from "react";
import type { SocketShip } from "../../ship/types/shipTypes";
import type { BoundingBox } from "../render/flightLayer";

export type LiveShipMessage = {
  sent_at: number;
  ship: SocketShip;
};

export type ShipSocketHandlers = {
  onMessage: (message: LiveShipMessage) => void;
  onError?: (error: string) => void;
};

export type ShipSocketSession = {
  updateViewport: (viewport: BoundingBox) => void;
  disconnect: () => void;
};

type StompClientFactory = (params: { brokerURL: string; token: string; handlers: ShipSocketHandlers }) => StompLikeClient;

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

export type ConnectShipSocketOptions = {
  token: string;
  viewport: BoundingBox;
  handlers: ShipSocketHandlers;
  brokerUrl?: string;
  viewportDebounceMs?: number;
  clientFactory?: StompClientFactory;
};

const DEFAULT_VIEWPORT_DEBOUNCE_MS = 300;
const SHIP_VIEWPORT_DESTINATION = "/app/ship-viewport";
const SHIP_TOPIC_DESTINATION = "/user/topic/ships";

export function connectShipSocket(options: ConnectShipSocketOptions): ShipSocketSession {
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
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const publishViewportNow = (): void => {
    if (!connected) {
      return;
    }
    try {
      client.publish({
        destination: SHIP_VIEWPORT_DESTINATION,
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

  const publishViewportImmediate = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    publishViewportNow();
  };

  client.setOnConnect(() => {
    connected = true;
    subscription = client.subscribe(SHIP_TOPIC_DESTINATION, (message) => {
      const payload = safeParseMessage(message.body);
      if (payload) {
        options.handlers.onMessage(payload);
      }
    });
    publishViewportImmediate();
  });

  client.setOnStompError((frame) => {
    options.handlers.onError?.(frame.headers?.message ?? "STOMP error");
  });

  client.activate();

  return {
    updateViewport: (nextViewport: BoundingBox) => {
      queuedViewport = nextViewport;
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

export function useShipSocket(
  token: string | null,
  viewport: BoundingBox,
  handlers: ShipSocketHandlers,
): void {
  const sessionRef = useRef<ShipSocketSession | null>(null);

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

    sessionRef.current = connectShipSocket({
      token,
      viewport: stableViewport,
      handlers,
    });

    return () => {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers, token]);

  useEffect(() => {
    sessionRef.current?.updateViewport(stableViewport);
  }, [stableViewport]);
}

function defaultStompClientFactory(params: {
  brokerURL: string;
  token: string;
  handlers: ShipSocketHandlers;
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

function safeParseMessage(payload: string): LiveShipMessage | null {
  try {
    return JSON.parse(payload) as LiveShipMessage;
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
