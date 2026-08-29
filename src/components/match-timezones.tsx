import { formatMatchTimesAllZones } from "@/lib/match-times";

export function MatchTimeZones({ at }: { at: Date }) {
  const zones = formatMatchTimesAllZones(at);

  return (
    <ul className="match-timezones">
      {zones.map((row) => (
        <li key={row.label}>
          <span className="match-tz-label">{row.label}</span>
          <span className="match-tz-when">{row.when}</span>
        </li>
      ))}
    </ul>
  );
}
