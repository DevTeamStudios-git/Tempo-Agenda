/**
 * Timezone-aware date helpers (Construction Notebook §14 + Notebook v2 §25-26).
 * Storage/wire format is always UTC ISO; display always goes through
 * `formatInTimeZone` so a user's local clock is never assumed.
 * Civil dates for all-day events are handled as yyyy-MM-dd in the event's
 * timezone, not as midnight UTC.
 */
import { addDays as fnsAddDays, addMonths as fnsAddMonths, startOfDay, startOfMonth } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

// Civil arithmetic is performed in UTC as a neutral calendar, then interpreted once.
function civilParts(date: Date, zone: string) {
  return formatInTimeZone(date, zone, "yyyy-MM-dd").split("-").map(Number) as [number, number, number];
}
function midnight(year: number, month: number, day: number, zone: string): Date {
  const key = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return fromZonedTime(key + "T00:00:00", zone);
}
export function mondayOf(date: Date, timeZone: string): Date { return startOfWeek(date, timeZone, "monday"); }
export function startOfWeek(date: Date, timeZone: string, weekStart: "monday" | "sunday" = "monday"): Date {
  const [y,m,d] = civilParts(date, timeZone);
  const dow = new Date(Date.UTC(y,m-1,d)).getUTCDay();
  return midnight(y,m,d - (weekStart === "monday" ? (dow+6)%7 : dow),timeZone);
}
export function addDays(date: Date, amount: number, timeZone?: string): Date {
  if (!timeZone) return fnsAddDays(date,amount);
  const [y,m,d] = civilParts(date,timeZone);
  return midnight(y,m,d+amount,timeZone);
}
export function addMonths(date: Date, amount: number, timeZone: string): Date {
  const [y,m] = civilParts(date,timeZone);
  return midnight(y,m+amount,1,timeZone);
}

export function startOfMonthInZone(date: Date, timeZone: string): Date {
  const zoned = toZonedTime(date, timeZone);
  return fromZonedTime(startOfDay(startOfMonth(zoned)), timeZone);
}

export function civilDayKey(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

/** Minutes since local midnight, in `timeZone`, for a UTC instant. */
export function minutesOfDay(isoInstant: string, timeZone: string): number {
  const zoned = toZonedTime(new Date(isoInstant), timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Combine a calendar day + minutes-of-day (in `timeZone`) into a UTC instant.
 *
 * Fix (Notebook v3 §4.3): this used to compute a DST round-trip check
 * (`roundTrip`/`expected`) purely to decide whether to throw, but the branch
 * that was supposed to act on it was left as comments only — so the check
 * ran on every call and its result was silently discarded. Invalid local
 * times (a spring-forward DST gap) still aren't rejected here; they pass
 * through however `date-fns-tz`'s `fromZonedTime` resolves them. If you
 * want strict rejection, check `isValidLocalTime` below at the call site
 * (e.g. in EventDialog, before calling this) rather than inside here, since
 * throwing from a date-math helper with several unguarded callers
 * (CalendarShell, EventDialog, useEventDrag) would crash the UI on an edge
 * case none of them currently catch.
 */
export function toInstant(dayIso: string, minutes: number, timeZone: string): string {
  const [y, m, d] = dayIso.split("-").map(Number);
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  const local = new Date((y ?? 1970), ((m ?? 1) - 1), d ?? 1, h, min, 0, 0);
  return fromZonedTime(local, timeZone).toISOString();
}

/** True if `dayIso`+`minutes` is a real local time in `timeZone` (false inside a DST spring-forward gap). */
export function isValidLocalTime(dayIso: string, minutes: number, timeZone: string): boolean {
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  const instant = toInstant(dayIso, minutes, timeZone);
  const roundTrip = formatInTimeZone(new Date(instant), timeZone, "yyyy-MM-dd HH:mm");
  const expected = `${dayIso} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return roundTrip === expected;
}

export function dayKey(isoInstant: string, timeZone: string): string {
  return formatInTimeZone(new Date(isoInstant), timeZone, "yyyy-MM-dd");
}

export function formatClock(isoInstant: string, timeZone: string): string {
  return formatInTimeZone(new Date(isoInstant), timeZone, "h:mm a");
}

export function formatClockWithFormat(isoInstant: string, timeZone: string, timeFormat: "12h" | "24h" = "12h"): string {
  return formatInTimeZone(new Date(isoInstant), timeZone, timeFormat === "24h" ? "HH:mm" : "h:mm a");
}

export function formatRange(startIso: string, endIso: string, timeZone: string, timeFormat: "12h" | "24h" = "12h"): string {
  return `${formatClockWithFormat(startIso, timeZone, timeFormat)} – ${formatClockWithFormat(endIso, timeZone, timeFormat)}`;
}

export function titleForView(anchor: Date, view: "day" | "week" | "month" | "agenda", timeZone: string, weekStart: "monday" | "sunday" = "monday"): string {
  if (view === "day") {
    return formatInTimeZone(anchor, timeZone, "EEEE, MMMM d, yyyy");
  }
  if (view === "month") {
    return formatInTimeZone(anchor, timeZone, "MMMM yyyy");
  }
  if (view === "agenda") {
    // Notebook v3 §3.1: agenda is "Next 30 days" from anchor's civil date
    const start = anchor;
    const end = addDays(start, 29, timeZone);
    const sameYear = formatInTimeZone(start, timeZone, "yyyy") === formatInTimeZone(end, timeZone, "yyyy");
    if (sameYear) {
      return `${formatInTimeZone(start, timeZone, "MMM d")} – ${formatInTimeZone(end, timeZone, "MMM d, yyyy")}`;
    }
    return `${formatInTimeZone(start, timeZone, "MMM d, yyyy")} – ${formatInTimeZone(end, timeZone, "MMM d, yyyy")}`;
  }
  // week
  const start = startOfWeek(anchor, timeZone, weekStart);
  const end = addDays(start, 6, timeZone);
  const sameMonth = formatInTimeZone(start, timeZone, "MMM") === formatInTimeZone(end, timeZone, "MMM");
  if (sameMonth) {
    return `${formatInTimeZone(start, timeZone, "MMM d")} – ${formatInTimeZone(end, timeZone, "d, yyyy")}`;
  }
  return `${formatInTimeZone(start, timeZone, "MMM d")} – ${formatInTimeZone(end, timeZone, "MMM d, yyyy")}`;
}

/** Split an event that spans civil days into per-day display segments (Notebook v2 §24). */
export function segmentEventByDay(event: { startAt: string; endAt: string }, timeZone: string): { dayKey: string; startMinutes: number; endMinutes: number }[] {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (end <= start) return [{ dayKey: dayKey(event.startAt, timeZone), startMinutes: 0, endMinutes: 15 }];
  const segments: { dayKey: string; startMinutes: number; endMinutes: number }[] = [];
  // Walk civil days in event timezone.
  let cursorKey = dayKey(event.startAt, timeZone);
  let cursorDate = toZonedTime(start, timeZone);
  const endZoned = toZonedTime(end, timeZone);
  // Safety cap for absurd ranges.
  for (let i = 0; i < 60; i++) {
    const isFirst = i === 0;
    const isLast = cursorKey === dayKey(event.endAt, timeZone);
    const startMin = isFirst ? cursorDate.getHours() * 60 + cursorDate.getMinutes() : 0;
    const endMin = isLast ? endZoned.getHours() * 60 + endZoned.getMinutes() : 1440;
    if (endMin > startMin) segments.push({ dayKey: cursorKey, startMinutes: startMin, endMinutes: endMin });
    if (isLast) break;
    // Advance to next civil day.
    const nextLocal = new Date(cursorDate);
    nextLocal.setDate(nextLocal.getDate() + 1);
    nextLocal.setHours(0, 0, 0, 0);
    cursorDate = nextLocal;
    cursorKey = formatInTimeZone(fromZonedTime(nextLocal, timeZone), timeZone, "yyyy-MM-dd");
    // If we've moved past end, break.
    if (fromZonedTime(nextLocal, timeZone) >= end) break;
  }
  return segments.length ? segments : [{ dayKey: dayKey(event.startAt, timeZone), startMinutes: 0, endMinutes: 1440 }];
}
