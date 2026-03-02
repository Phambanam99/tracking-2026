import { describe, expect, test } from "vitest";
import { connectFlightSocket, type StompLikeClient, type StompSubscriptionLike } from "./useFlightSocket";

class FakeSubscription implements StompSubscriptionLike {
  public unsubscribed = false;

  public unsubscribe(): void {
    this.unsubscribed = true;
  }
}

class FakeStompClient implements StompLikeClient {
  public activated = false;
  public deactivated = false;
  public lastPublish: { destination: string; body: string } | null = null;
  public subscription: FakeSubscription | null = null;
  public connectHandler: (() => void) | null = null;
  public messageHandler: ((message: { body: string }) => void) | null = null;

  public activate(): void {
    this.activated = true;
  }

  public deactivate(): void {
    this.deactivated = true;
  }

  public publish(args: { destination: string; body: string }): void {
    this.lastPublish = args;
  }

  public subscribe(_: string, callback: (message: { body: string }) => void): StompSubscriptionLike {
    this.messageHandler = callback;
    this.subscription = new FakeSubscription();
    return this.subscription;
  }

  public setOnConnect(callback: () => void): void {
    this.connectHandler = callback;
  }

  public setOnStompError(_: (frame: { headers?: Record<string, string> }) => void): void {
    // no-op
  }
}

describe("connectFlightSocket", () => {
  test("should subscribe and publish viewport on connect", () => {
    const fakeClient = new FakeStompClient();
    const received: unknown[] = [];

    const session = connectFlightSocket({
      token: "access-token",
      viewport: { north: 22, south: 20, east: 106, west: 105 },
      handlers: {
        onMessage: (message) => received.push(message),
      },
      brokerUrl: "ws://localhost/ws/live",
      clientFactory: () => fakeClient,
    });

    expect(fakeClient.activated).toBe(true);
    fakeClient.connectHandler?.();

    expect(fakeClient.lastPublish?.destination).toBe("/app/viewport");

    fakeClient.messageHandler?.({
      body: JSON.stringify({
        sent_at: Date.now(),
        flight: { icao: "ABC123", lat: 1, lon: 2, event_time: Date.now(), source_id: "test" },
      }),
    });
    expect(received).toHaveLength(1);

    session.disconnect();
    expect(fakeClient.subscription?.unsubscribed).toBe(true);
    expect(fakeClient.deactivated).toBe(true);
  });

  test("should queue viewport updates until stomp is connected", () => {
    const fakeClient = new FakeStompClient();
    const session = connectFlightSocket({
      token: "access-token",
      viewport: { north: 22, south: 20, east: 106, west: 105 },
      handlers: {
        onMessage: () => {},
      },
      brokerUrl: "ws://localhost/ws/live",
      clientFactory: () => fakeClient,
    });

    session.updateViewport({ north: 24, south: 21, east: 107, west: 104 });
    expect(fakeClient.lastPublish).toBeNull();

    fakeClient.connectHandler?.();
    expect(fakeClient.lastPublish?.destination).toBe("/app/viewport");
    expect(fakeClient.lastPublish?.body).toContain("\"north\":24");
  });

  test("should append access_token query to broker url", () => {
    let capturedBrokerUrl = "";
    const fakeClient = new FakeStompClient();

    connectFlightSocket({
      token: "token+123",
      viewport: { north: 22, south: 20, east: 106, west: 105 },
      handlers: {
        onMessage: () => {},
      },
      brokerUrl: "ws://localhost/ws/live",
      clientFactory: ({ brokerURL }) => {
        capturedBrokerUrl = brokerURL;
        return fakeClient;
      },
    });

    expect(capturedBrokerUrl).toBe("ws://localhost/ws/live?access_token=token%2B123");
  });
});
