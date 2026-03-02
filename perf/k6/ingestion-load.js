import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://localhost:18080";
const ingestPath = __ENV.INGEST_PATH || "/api/v1/ingest/adsb/batch";
const apiKey = __ENV.API_KEY || "dev-key";
const sourceId = __ENV.SOURCE_ID || "RADAR-K6";
const bodySourceId = __ENV.BODY_SOURCE_ID || sourceId;
const batchSize = Number(__ENV.BATCH_SIZE || 1000);
const requestRate = Number(__ENV.REQUEST_RATE || 100);
const duration = __ENV.DURATION || "2m";
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 200);
const maxVUs = Number(__ENV.MAX_VUS || 400);
const thinkTimeMs = Number(__ENV.THINK_TIME_MS || 0);
const baseLat = Number(__ENV.BASE_LAT || 21.0285);
const baseLon = Number(__ENV.BASE_LON || 105.8542);
const latJitter = Number(__ENV.LAT_JITTER || 0.05);
const lonJitter = Number(__ENV.LON_JITTER || 0.05);
const icaoOffset = Number(__ENV.ICAO_OFFSET || 0);
const trackPoolSize = Number(__ENV.TRACK_POOL_SIZE || 1024);
const liveEventLagMs = Number(__ENV.LIVE_EVENT_LAG_MS || 300000);
const trajectoryPeriodSeconds = Number(__ENV.TRAJECTORY_PERIOD_SECONDS || 240);
const historicalRatio = Number(__ENV.HISTORICAL_RATIO || 0);
const duplicateRatio = Number(__ENV.DUPLICATE_RATIO || 0);
const invalidRatio = Number(__ENV.INVALID_RATIO || 0);
const futureEventRatio = Number(__ENV.FUTURE_EVENT_RATIO || 0);
const sourceMismatchRatio = Number(__ENV.SOURCE_ID_MISMATCH_RATIO || 0);
const historicalSkewMs = Number(__ENV.HISTORICAL_SKEW_MS || 300000);
const futureEventSkewMs = Number(__ENV.FUTURE_EVENT_SKEW_MS || 60000);
const invalidMode = __ENV.INVALID_MODE || "lat";
const spoofedBodySourceId = __ENV.SPOOFED_BODY_SOURCE_ID || "SPOOFED-SOURCE";
const acceptedStatusCodes = new Set(
  (__ENV.ACCEPTED_STATUS_CODES || "202")
    .split(",")
    .map((code) => Number(code.trim()))
    .filter((code) => Number.isFinite(code)),
);
const expectedStatuses = Array.from(acceptedStatusCodes);

const expectedStatusRate = new Rate("ingest_batch_expected_status");
const status2xxCounter = new Counter("ingest_batch_status_2xx");
const status4xxCounter = new Counter("ingest_batch_status_4xx");
const status5xxCounter = new Counter("ingest_batch_status_5xx");
const status202Counter = new Counter("ingest_batch_status_202");
const status400Counter = new Counter("ingest_batch_status_400");
const status401Counter = new Counter("ingest_batch_status_401");
const status403Counter = new Counter("ingest_batch_status_403");
const status413Counter = new Counter("ingest_batch_status_413");
const status429Counter = new Counter("ingest_batch_status_429");
const status503Counter = new Counter("ingest_batch_status_503");

export const options = {
  scenarios: {
    ingest_batch: {
      executor: "constant-arrival-rate",
      rate: requestRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs,
      maxVUs,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{scenario:ingest_batch}": ["p(95)<750", "p(99)<1200"],
    ingest_batch_expected_status: ["rate>0.99"],
    dropped_iterations: ["count==0"],
  },
};

function recordStatusCounters(status) {
  if (status >= 200 && status < 300) {
    status2xxCounter.add(1);
  } else if (status >= 400 && status < 500) {
    status4xxCounter.add(1);
  } else if (status >= 500 && status < 600) {
    status5xxCounter.add(1);
  }

  switch (status) {
    case 202:
      status202Counter.add(1);
      break;
    case 400:
      status400Counter.add(1);
      break;
    case 401:
      status401Counter.add(1);
      break;
    case 403:
      status403Counter.add(1);
      break;
    case 413:
      status413Counter.add(1);
      break;
    case 429:
      status429Counter.add(1);
      break;
    case 503:
      status503Counter.add(1);
      break;
    default:
      break;
  }
}

function nextIcao(seed) {
  const value = (0x880000 + ((seed + icaoOffset) % 0x0fffff)).toString(16).toUpperCase();
  return value.padStart(6, "0").slice(-6);
}

function scopedTrack(globalIndex) {
  const trackIndex = globalIndex % trackPoolSize;
  const scopedTrackIndex = ((__VU - 1) * trackPoolSize) + trackIndex;

  return {
    trackIndex,
    scopedTrackIndex,
  };
}

function centeredOffset(seed, amplitude) {
  return ((((seed % 1000) / 999) - 0.5) * amplitude);
}

function wrapCycle(value, cycle) {
  const normalized = value % cycle;
  return normalized >= 0 ? normalized : normalized + cycle;
}

function trackDescriptor(scopedTrackIndex) {
  const originLat = baseLat + centeredOffset((scopedTrackIndex * 17) + 11, latJitter * 0.5);
  const originLon = baseLon + centeredOffset((scopedTrackIndex * 29) + 23, lonJitter * 0.5);
  const latAmplitude = Math.max(latJitter * (0.35 + ((scopedTrackIndex % 23) / 30)), 0.01);
  const lonAmplitude = Math.max(lonJitter * (0.35 + ((scopedTrackIndex % 19) / 30)), 0.01);
  const phaseOffsetRad = (((scopedTrackIndex % 360) * Math.PI) / 180);
  const latAmplitudeKm = latAmplitude * 111.32;
  const lonAmplitudeKm = lonAmplitude * Math.max(Math.cos((originLat * Math.PI) / 180), 0.2) * 111.32;
  const loopDistanceKm = 2 * Math.PI * Math.sqrt(((latAmplitudeKm ** 2) + (lonAmplitudeKm ** 2)) / 2);
  const orbitSpeedKmh = loopDistanceKm / (trajectoryPeriodSeconds / 3600);

  return {
    originLat,
    originLon,
    latAmplitude,
    lonAmplitude,
    phaseOffsetRad,
    speed: Math.max(orbitSpeedKmh, 120),
  };
}

function trackPosition(descriptor, eventTime) {
  const cycleMs = trajectoryPeriodSeconds * 1000;
  const orbitPhase = (wrapCycle(eventTime, cycleMs) / cycleMs) * 2 * Math.PI;
  const angle = orbitPhase + descriptor.phaseOffsetRad;

  return {
    lat: descriptor.originLat + (Math.sin(angle) * descriptor.latAmplitude),
    lon: descriptor.originLon + (Math.cos(angle) * descriptor.lonAmplitude),
    speed: descriptor.speed,
    heading: wrapCycle(((angle * 180) / Math.PI) + 90, 360),
  };
}

function ratioHit(seed, ratio) {
  if (ratio <= 0) {
    return false;
  }

  return (seed % 10000) < (ratio * 10000);
}

function cloneRecord(record) {
  return {
    icao: record.icao,
    lat: record.lat,
    lon: record.lon,
    altitude: record.altitude,
    speed: record.speed,
    heading: record.heading,
    event_time: record.event_time,
    source_id: record.source_id,
  };
}

function mutateInvalidRecord(record) {
  const nextRecord = cloneRecord(record);
  switch (invalidMode) {
    case "missing-icao":
      nextRecord.icao = "";
      return nextRecord;
    case "event-time":
      nextRecord.event_time = -1;
      return nextRecord;
    case "source":
      nextRecord.source_id = "";
      return nextRecord;
    case "lat":
    default:
      nextRecord.lat = 999.0;
      return nextRecord;
  }
}

function buildRecord(globalIndex, now) {
  const seed = ((__VU - 1) * 1000000) + globalIndex;
  const track = scopedTrack(globalIndex);
  let eventTime = now - liveEventLagMs;
  if (ratioHit(seed + 11, historicalRatio)) {
    eventTime -= historicalSkewMs;
  }
  if (ratioHit(seed + 17, futureEventRatio)) {
    eventTime += futureEventSkewMs;
  }
  const descriptor = trackDescriptor(track.scopedTrackIndex);
  const position = trackPosition(descriptor, eventTime);

  let record = {
    icao: nextIcao(track.scopedTrackIndex),
    lat: position.lat,
    lon: position.lon,
    altitude: 11000 + (track.trackIndex % 1000),
    speed: position.speed,
    heading: position.heading,
    event_time: eventTime,
    source_id: ratioHit(seed + 23, sourceMismatchRatio) ? spoofedBodySourceId : bodySourceId,
  };

  if (ratioHit(seed + 29, invalidRatio)) {
    record = mutateInvalidRecord(record);
  }

  return record;
}

function buildBatch(size) {
  const now = Date.now();
  const batch = [];

  for (let index = 0; index < size; index += 1) {
    const globalIndex = (__ITER * size) + index;
    const seed = ((__VU - 1) * 1000000) + globalIndex;
    const record = buildRecord(globalIndex, now);
    if (index > 0 && ratioHit(seed + 31, duplicateRatio)) {
      batch.push(cloneRecord(batch[index - 1]));
      continue;
    }
    batch.push(record);
  }

  return {
    records: batch,
  };
}

export default function () {
  const response = http.post(
    `${baseUrl}${ingestPath}`,
    JSON.stringify(buildBatch(batchSize)),
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "X-Source-Id": sourceId,
      },
      responseCallback: http.expectedStatuses(...expectedStatuses),
      timeout: "2s",
    },
  );

  recordStatusCounters(response.status);

  const matchesExpectation = check(response, {
    "ingest batch matched expected status": (result) => acceptedStatusCodes.has(result.status),
  });

  expectedStatusRate.add(matchesExpectation);

  if (thinkTimeMs > 0) {
    sleep(thinkTimeMs / 1000);
  }
}
