import http from "k6/http";
import { sleep } from "k6";

export const options = {
  scenarios: {
    ingest_stress: {
      executor: "constant-arrival-rate",
      rate: 10000,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
};

export default function () {
  const payload = JSON.stringify([
    {
      icao: "888123",
      lat: 21.0285,
      lon: 105.8542,
      event_time: Date.now(),
      source_id: "k6",
    },
  ]);

  http.post("http://localhost:8080/api/v1/ingest", payload, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "dev-key",
    },
  });

  sleep(0.1);
}
