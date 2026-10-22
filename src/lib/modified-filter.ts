/** Pakistan time, so “today” matches the cup’s calendar day. */
const PKT = "Asia/Karachi";
const DAY_MS = 24 * 60 * 60 * 1000;

export const MODIFIED_FILTER_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export function formatModifiedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PKT,
  });
}

function pktDayKey(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: PKT });
}

export function matchesModifiedFilter(iso: string, value: string, now = Date.now()) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return false;
  if (value === "today") return pktDayKey(at) === pktDayKey(now);
  if (value === "7d") return now - at <= 7 * DAY_MS && now >= at;
  if (value === "30d") return now - at <= 30 * DAY_MS && now >= at;
  return true;
}
