import { RRule } from "rrule";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { EventRecord } from "@/features/calendar/types";

const allowed = new Set(["FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY", "BYMONTH", "BYSETPOS", "WKST"]);
export function validateRule(text: string): boolean {
  try {
    const head = text.split(/\r?\n/)[0]!.replace(/^RRULE:/, "");
    const parts = head.split(";");
    if (parts.some(p => !allowed.has(p.split("=")[0]!))) return false;
    if (!/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/.test(head)) return false;
    if (head.includes("COUNT=") && head.includes("UNTIL=")) return false;
    const options = RRule.parseString(head);
    if ((options.interval ?? 1) < 1 || (options.count ?? 1) < 1) return false;
    return text.split(/\r?\n/).slice(1).every(line => /^EXDATE:/.test(line) && line.slice(7).split(",").every(x => Number.isFinite(Date.parse(x))));
  } catch { return false; }
}
function floating(instant: string, zone: string) {
  return new Date(formatInTimeZone(instant, zone, "yyyy-MM-dd'T'HH:mm:ss") + "Z");
}
function real(date: Date, zone: string) {
  return fromZonedTime(date.toISOString().slice(0,19), zone);
}
export function ruleFor(event: Pick<EventRecord,"startAt" | "timezone" | "recurrence">): RRule {
  const head = event.recurrence!.rrule.split(/\r?\n/)[0]!.replace(/^RRULE:/, "");
  const opts = RRule.parseString(head);
  // Floating UTC values represent civil times; conversion occurs once after expansion.
  if (opts.until) opts.until = floating(opts.until.toISOString(), event.timezone);
  return new RRule({ ...opts, dtstart: floating(event.startAt,event.timezone) });
}
export function expandEvents(events: EventRecord[], start: Date, end: Date): EventRecord[] {
  const result: EventRecord[] = [];
  for (const event of events) {
    if (!event.recurrence?.rrule) {
      if (new Date(event.startAt) < end && (new Date(event.endAt) > start || (event.allDay && new Date(event.endAt) >= start))) result.push(event);
      continue;
    }
    if (!validateRule(event.recurrence.rrule)) continue;
    const duration = Math.max(0,Date.parse(event.endAt) - Date.parse(event.startAt));
    const civilDuration = floating(event.endAt,event.timezone).getTime() - floating(event.startAt,event.timezone).getTime();
    const exclusions = new Set(event.recurrence.rrule.split(/\r?\n/).slice(1).flatMap(l=>l.slice(7).split(",")).map(x=>new Date(x).toISOString()));
    const lower = new Date(start.getTime() - Math.max(duration,civilDuration) - 172800000);
    const upper = new Date(end.getTime() + 172800000);
    let count = 0;
    const occurrences = ruleFor(event).between(floating(lower.toISOString(),event.timezone),floating(upper.toISOString(),event.timezone),true,() => ++count <= 10000);
    for (const date of occurrences) {
      const at = real(date,event.timezone);
      const finish = event.allDay ? real(new Date(date.getTime()+civilDuration),event.timezone) : new Date(at.getTime()+duration);
      if (at >= end || (finish <= start && !(event.allDay && finish >= start)) || exclusions.has(at.toISOString())) continue;
      result.push({...event,id:`${event.id}~${at.toISOString()}`, startAt:at.toISOString(),endAt:finish.toISOString(),occurrenceOf:{seriesId:event.id,originalStartAt:at.toISOString()}});
    }
  }
  return result.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
}
export function excludeOccurrence(rule: string, at: string) {
  const lines=rule.split(/\r?\n/);
  const dates=new Set([...lines.slice(1).flatMap(l=>l.slice(7).split(",")),new Date(at).toISOString()]);
  return lines[0] + "\nEXDATE:" + [...dates].join(",");
}
