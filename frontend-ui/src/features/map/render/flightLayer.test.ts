import { toFlightLayerData } from "./flightLayer";

const data = toFlightLayerData([]);
if (!Array.isArray(data)) {
  throw new Error("flight layer output should be array");
}
