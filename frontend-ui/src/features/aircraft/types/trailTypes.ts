export type TrailPosition = {
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  eventTime: number;
};

export type TrailRoute = {
  icao: string;
  positions: TrailPosition[];
  color: string;
};
