export const MATCH_TIME_ZONES = [
  { label: "Pakistan", iana: "Asia/Karachi" },
  { label: "UK", iana: "Europe/London" },
  { label: "Sweden", iana: "Europe/Stockholm" },
  { label: "Europe (CET)", iana: "Europe/Paris" },
  { label: "US East", iana: "America/New_York" },
  { label: "US West", iana: "America/Los_Angeles" },
] as const;

export type MatchTimeZoneRow = {
  label: string;
  when: string;
};

const SLOT_DAY = ["Friday", "Saturday", "Sunday"] as const;

export function weekendSlotLabel(slotIndex: number): string {
  return SLOT_DAY[slotIndex] ?? "Match";
}

export function formatInTimeZone(date: Date, iana: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: iana,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatMatchTimesAllZones(date: Date): MatchTimeZoneRow[] {
  return MATCH_TIME_ZONES.map((zone) => ({
    label: zone.label,
    when: formatInTimeZone(date, zone.iana),
  }));
}
