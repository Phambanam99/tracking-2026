const ALTITUDE_BANDS = [
  { label: "Ground", color: "#808080" },
  { label: "< 1,000 ft", color: "#00ff00" },
  { label: "< 5,000 ft", color: "#00dd88" },
  { label: "< 10,000 ft", color: "#00bbff" },
  { label: "< 20,000 ft", color: "#0055ff" },
  { label: "< 30,000 ft", color: "#aa00ff" },
  { label: ">= 30,000 ft", color: "#ff00aa" },
];

export function AltitudeLegend(): JSX.Element {
  return (
    <aside className="pointer-events-none absolute bottom-12 right-3 z-10 w-44 rounded-lg border border-slate-700 bg-slate-950/90 p-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Altitude
      </p>
      <ul className="space-y-1.5">
        {ALTITUDE_BANDS.map((band) => (
          <li className="flex items-center gap-2 text-xs text-slate-200" key={band.label}>
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            <span>{band.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
