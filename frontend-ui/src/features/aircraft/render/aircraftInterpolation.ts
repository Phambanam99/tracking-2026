/**
 * Aircraft position interpolation utility.
 *
 * PERF-3 FIX: Instead of teleporting aircraft between received positions,
 * we smoothly interpolate between the last known position and the new target
 * using linear interpolation driven by requestAnimationFrame in AircraftMapLayer.
 *
 * Usage:
 *   const interpolator = new AircraftInterpolator(aircraft.lat, aircraft.lon);
 *   interpolator.setTarget(newLat, newLon, estimatedTravelMs);
 *   // On each RAF tick:
 *   const [lat, lon] = interpolator.current();
 */
export class AircraftInterpolator {
    private fromLat: number;
    private fromLon: number;
    private toLat: number;
    private toLon: number;
    /** Epoch ms when the interpolation towards the new target started. */
    private startedAt: number;
    /** Duration in ms for the interpolation. */
    private durationMs: number;

    constructor(lat: number, lon: number) {
        this.fromLat = lat;
        this.fromLon = lon;
        this.toLat = lat;
        this.toLon = lon;
        this.startedAt = Date.now();
        this.durationMs = 0;
    }

    /**
     * Set a new target position to smoothly interpolate towards.
     *
     * @param lat Target latitude
     * @param lon Target longitude
     * @param durationMs How long the interpolation should take (ms).
     *   Typically the server update interval (e.g. 1000 ms for 1 msg/s feeds).
     */
    setTarget(lat: number, lon: number, durationMs: number): void {
        // Start from the current interpolated position so motion is continuous
        // even if a new target arrives before the previous interpolation finishes.
        const [curLat, curLon] = this.current();
        this.fromLat = curLat;
        this.fromLon = curLon;
        this.toLat = lat;
        this.toLon = lon;
        this.startedAt = Date.now();
        this.durationMs = Math.max(1, durationMs);
    }

    /** Returns the interpolated [lat, lon] for the current moment in time. */
    current(): [number, number] {
        if (this.durationMs === 0) {
            return [this.toLat, this.toLon];
        }
        const elapsed = Date.now() - this.startedAt;
        const t = Math.min(1, elapsed / this.durationMs);
        // Ease-out cubic: slows down as we approach the target.
        const eased = 1 - Math.pow(1 - t, 3);
        return [
            this.fromLat + (this.toLat - this.fromLat) * eased,
            this.fromLon + (this.toLon - this.fromLon) * eased,
        ];
    }

    /** True if interpolation has completed (no more animation needed). */
    isSettled(): boolean {
        if (this.durationMs === 0) return true;
        return Date.now() - this.startedAt >= this.durationMs;
    }
}
