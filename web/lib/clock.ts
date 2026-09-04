const DAY = 86400;
const OPEN_OFFSET = 9 * 3600 + 1800;
const CLOSE_OFFSET = 16 * 3600;

// NYSE closures for 2026 and 2027, days since the unix epoch
export const HOLIDAYS = new Set([
  20454, 20472, 20500, 20546, 20598, 20623, 20637, 20703, 20783, 20812, 20819, 20836, 20864, 20903,
  20969, 20987, 21004, 21067, 21147, 21176,
]);

export type MarketState = "open" | "blackout" | "halted";

/** Midnight UTC of the nth given weekday in a month. 1 = Monday, 7 = Sunday. */
function nthWeekday(year: number, month: number, n: number, weekday: number) {
  const first = Date.UTC(year, month - 1, 1) / 1000;
  const firstDow = dow(first);
  let day = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7;
  return Date.UTC(year, month - 1, day) / 1000;
}

function dow(ts: number) {
  const d = new Date(ts * 1000).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Seconds behind UTC that New York is running. */
export function etOffset(ts: number) {
  const year = new Date(ts * 1000).getUTCFullYear();
  const start = nthWeekday(year, 3, 2, 7) + 7 * 3600;
  const end = nthWeekday(year, 11, 1, 7) + 6 * 3600;
  return ts >= start && ts < end ? 4 * 3600 : 5 * 3600;
}

export function isTradingDay(epochDay: number) {
  return dow(epochDay * DAY) <= 5 && !HOLIDAYS.has(epochDay);
}

export function sessionBounds(epochDay: number) {
  const dayStart = epochDay * DAY;
  const offset = etOffset(dayStart + 12 * 3600);
  return {
    openTs: dayStart + offset + OPEN_OFFSET,
    closeTs: dayStart + offset + CLOSE_OFFSET,
  };
}

export function lastClose(ts: number) {
  const day = Math.floor(ts / DAY);
  for (let i = 0; i < 10; i++) {
    const d = day - i;
    if (!isTradingDay(d)) continue;
    const {closeTs} = sessionBounds(d);
    if (closeTs <= ts) return closeTs;
  }
  return 0;
}

export function nextOpen(ts: number) {
  const day = Math.floor(ts / DAY);
  for (let i = 0; i < 10; i++) {
    const d = day + i;
    if (!isTradingDay(d)) continue;
    const {openTs} = sessionBounds(d);
    if (openTs > ts) return openTs;
  }
  return 0;
}

export function scheduleState(ts: number): "open" | "blackout" {
  const day = Math.floor(ts / DAY);
  if (!isTradingDay(day)) return "blackout";
  const {openTs, closeTs} = sessionBounds(day);
  return ts >= openTs && ts < closeTs ? "open" : "blackout";
}

export function marketState(ts: number, secondsStale: number, haltTolerance = 5400): MarketState {
  if (scheduleState(ts) === "blackout") return "blackout";
  return secondsStale > haltTolerance ? "halted" : "open";
}

export function formatET(ts: number) {
  const shifted = new Date((ts - etOffset(ts)) * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${days[shifted.getUTCDay()]} ${hh}:${mm} ET`;
}

export function splitDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return {
    hours: Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
