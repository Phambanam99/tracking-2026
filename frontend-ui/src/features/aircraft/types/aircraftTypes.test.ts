import { describe, expect, test, vi } from "vitest";
import { resolveAircraftEnrichment, toAircraft, type AircraftFlight } from "./aircraftTypes";

describe("toAircraft", () => {
  test("should map backend snake_case payload and nested metadata", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000123);

    const aircraft = toAircraft({
      icao: "A1B2C3",
      lat: 10.1234,
      lon: 106.5678,
      altitude: 35000,
      speed: 450,
      heading: 270,
      event_time: 1700000000000,
      source_id: "RADARBOX-GLOBAL",
      metadata: {
        registration: "VN-A321",
        aircraft_type: "A321",
        operator: "Vietnam Airlines",
        country_code: "VN",
        country_flag_url: "https://flagcdn.com/h80/vn.png",
      },
    });

    expect(aircraft).toMatchObject({
      icao: "A1B2C3",
      lat: 10.1234,
      lon: 106.5678,
      altitude: 35000,
      speed: 450,
      heading: 270,
      eventTime: 1700000000000,
      sourceId: "RADARBOX-GLOBAL",
      registration: "VN-A321",
      aircraftType: "A321",
      operator: "Vietnam Airlines",
      countryCode: "VN",
      countryFlagUrl: "https://flagcdn.com/h80/vn.png",
      lastSeen: 1700000000123,
      isMilitary: false,
    });
  });

  test("should derive fallback country and registration when metadata is missing", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000999);

    const flight: AircraftFlight = {
      icao: "A00001",
      lat: 11.1,
      lon: 108.2,
      event_time: 1700000000888,
      source_id: "FR24-GLOBAL",
    };

    const aircraft = toAircraft(flight);

    expect(aircraft.eventTime).toBe(1700000000888);
    expect(aircraft.sourceId).toBe("FR24-GLOBAL");
    expect(aircraft.registration).toBe("N1");
    expect(aircraft.aircraftType).toBeNull();
    expect(aircraft.operator).toBeNull();
    expect(aircraft.countryCode).toBe("US");
    expect(aircraft.countryFlagUrl).toBe("https://flagcdn.com/h80/us.png");
    expect(aircraft.lastSeen).toBe(1700000000999);
    expect(aircraft.isMilitary).toBe(false);
  });

  test("should read nested metadata in snake_case from the runtime wire contract", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000001555);

    const aircraft = toAircraft({
      icao: "ABC789",
      lat: 16.1,
      lon: 108.2,
      event_time: 1700000001444,
      source_id: "ADSBX-SNAPSHOT",
      metadata: {
        registration: "N123AB",
        aircraft_type: "B738",
        operator: "Test Air",
        country_code: "US",
        country_flag_url: "https://flagcdn.com/h80/us.png",
      },
    });

    expect(aircraft).toMatchObject({
      registration: "N123AB",
      aircraftType: "B738",
      operator: "Test Air",
      countryCode: "US",
      countryFlagUrl: "https://flagcdn.com/h80/us.png",
      eventTime: 1700000001444,
      sourceId: "ADSBX-SNAPSHOT",
      lastSeen: 1700000001555,
      isMilitary: false,
    });
  });

  test("should map military flag from backend metadata", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000002666);

    const aircraft = toAircraft({
      icao: "AE292B",
      lat: 25.1,
      lon: 55.2,
      event_time: 1700000002555,
      source_id: "ADSB-HCKT",
      metadata: {
        is_military: true,
      },
    });

    expect(aircraft).toMatchObject({
      icao: "AE292B",
      isMilitary: true,
      lastSeen: 1700000002666,
    });
  });

  test("should preserve backend metadata over fallback enrichment", () => {
    const enrichment = resolveAircraftEnrichment({
      icao: "A00001",
      registration: "CUSTOM-REG",
      aircraftType: "B738",
      operator: "Custom Air",
      countryCode: "CA",
      countryFlagUrl: "https://flagcdn.com/h80/ca.png",
      isMilitary: true,
    });

    expect(enrichment).toEqual({
      registration: "CUSTOM-REG",
      aircraftType: "B738",
      operator: "Custom Air",
      countryCode: "CA",
      countryFlagUrl: "https://flagcdn.com/h80/ca.png",
      isMilitary: true,
    });
  });
});
