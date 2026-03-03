import { describe, expect, test } from "vitest";
import { connectShipSocket, type StompLikeClient, type StompSubscriptionLike } from "./useShipSocket";

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

describe("connectShipSocket", () => {
  test("subscribes to ship topic and publishes ship viewport on connect", () => {
    const fakeClient = new FakeStompClient();
    const received: unknown[] = [];

    const session = connectShipSocket({
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

    expect(fakeClient.lastPublish?.destination).toBe("/app/ship-viewport");

    fakeClient.messageHandler?.({
      body: JSON.stringify({
        sent_at: Date.now(),
        ship: { mmsi: "574001230", lat: 1, lon: 2, event_time: Date.now(), source_id: "AIS" },
      }),
    });
    expect(received).toHaveLength(1);

    session.disconnect();
    expect(fakeClient.subscription?.unsubscribed).toBe(true);
    expect(fakeClient.deactivated).toBe(true);
  });

  test("queues ship viewport updates until stomp is connected", () => {
    const fakeClient = new FakeStompClient();
    const session = connectShipSocket({
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
    expect(fakeClient.lastPublish?.destination).toBe("/app/ship-viewport");
    expect(fakeClient.lastPublish?.body).toContain("\"north\":24");
  });
});
