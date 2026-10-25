import {excludeOccurrence} from "@/lib/recurrence/engine";
/**
 * Tempo Agenda V2 — RFC 5545 (iCal) serializer/parser.
 *
 * Export: `serializeIcs(events, calendars, calName)` → a complete VCALENDAR
 * string matching the app's domain conventions:
 *   - timed events   → civil local times in the event's own timezone,
 *     exported as `DTSTART;TZID=<IANA>:YYYYMMDDTHHMMSS`
 *   - all-day events → `DTSTART;VALUE=DATE:` + `DTEND;VALUE=DATE:` where
 *     DTEND is *exclusive* (iCal convention). Tempo's records are authored
 *     with an inclusive end civil day (see the all-day chips in TimeGrid),
 *     so we add one civil day on export.
 * Reminders (VALARM) are not exported: the domain keeps them as server-side
 * `Reminder` rows, not as part of EventRecord.
 *
 * Import: `parseIcs(text, fallbackTz)` → `{ events, notes }` where `events`
 * carry ISO instants interpreted in the event's TZID (or `fallbackTz`),
 * all-day DTEND is converted from iCal's *exclusive* convention back to the
 * app's *inclusive* last civil day, and unsupported-but-noted features
 * (e.g. RRULE) are surfaced as `notes` + a `labels` tag instead of being
 * silently dropped.
 */
import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { CalendarSummary, EventRecord } from "@/features/calendar/types";

export interface IcsEvent {
  /** Original UID, if the file supplied one. */
  uid?: string;
  recurrenceId?:string;
  visibility?:"private"|"public"|"default";
  availability?:"busy"|"free";
  title: string;
  description?: string;
  location?: string;
  /** ISO instant. For all-day: midnight (00:00) of the first day in `timezone`. */
  startAt: string;
  /** ISO instant. For all-day: 00:00 of the *inclusive* last civil day (app convention). */
  endAt: string;
  allDay: boolean;
  /** IANA timezone the civil times were interpreted in. */
  timezone: string;
  status?: "confirmed" | "tentative" | "cancelled";
  categories: string[];
  /** Raw RRULE string, if present (kept — not expanded). */
  rrule?: string;
}

interface ParseOutput {
  events: IcsEvent[];
  /** One entry per issue that was tolerated during parsing. */
  notes: string[];
}

// ── escape helpers (RFC 5545 §3.3.11) ───────────────────────────────────────

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsUnescape(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch !== "\\") { out += ch; continue; }
    const next = value[++i];
    if (next === "n" || next === "N") out += "\n";
    else if (next === "\\" || next === ";" || next === ",") out += next;
    else if (next !== undefined) out += next; // tolerate malformed escapes
  }
  return out;
}

// ── serialization ───────────────────────────────────────────────────────────

function foldLine(line:string):string {
  const encoder=new TextEncoder(); let bytes=0,out="";
  for(const char of line) { const size=encoder.encode(char).length; if(bytes+size>75){out+="\r\n ";bytes=1;}out+=char;bytes+=size; }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function civilStamp(instant: string, timeZone: string): string {
  // YYYYMMDD civil stamp in the given timezone.
  const zoned = toZonedTime(new Date(instant), timeZone);
  return `${zoned.getFullYear()}${pad2(zoned.getMonth() + 1)}${pad2(zoned.getDate())}`;
}

function civilDateTime(instant: string, timeZone: string): string {
  const zoned = toZonedTime(new Date(instant), timeZone);
  return `${civilStamp(instant, timeZone)}T${pad2(zoned.getHours())}${pad2(zoned.getMinutes())}${pad2(zoned.getSeconds())}`;
}

const STATUS_TO_ICS: Record<string, string> = {
  confirmed: "CONFIRMED",
  tentative: "TENTATIVE",
  cancelled: "CANCELLED",
};

export function serializeIcs(
  events: EventRecord[],
  calendars: CalendarSummary[],
  calName = "Tempo Agenda V2",
): string {
  void calendars; // calendar names are carried per-event via the dialog; reserved for grouping
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tempo Agenda V2//V2//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];

  const now = formatInTimeZone(new Date(), "UTC", "yyyyMMdd'T'HHmmss'Z'");
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${icsEscape(e.id)}@tempo-agenda-v2`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);

    if (e.allDay) {
      // DTEND is exclusive by RFC 5545; Tempo keeps the inclusive last day
      // (civil day of endAt) → exclusive DTEND = civil day of endAt + 1 day.
      const key=civilStamp(e.endAt,e.timezone);
      const next=new Date(Date.UTC(+key.slice(0,4),+key.slice(4,6)-1,+key.slice(6,8)+1));
      lines.push(`DTSTART;VALUE=DATE:${civilStamp(e.startAt,e.timezone)}`);
      lines.push(`DTEND;VALUE=DATE:${next.toISOString().slice(0,10).replaceAll("-","")}`);
    } else {
      lines.push(e.recurrence ? `DTSTART;TZID=${e.timezone}:${civilDateTime(e.startAt,e.timezone)}` : `DTSTART:${formatInTimeZone(e.startAt,"UTC","yyyyMMdd'T'HHmmss'Z'")}`);
      lines.push(e.recurrence ? `DTEND;TZID=${e.timezone}:${civilDateTime(e.endAt,e.timezone)}` : `DTEND:${formatInTimeZone(e.endAt,"UTC","yyyyMMdd'T'HHmmss'Z'")}`);
    }

    lines.push(`X-TEMPO-TIMEZONE:${e.timezone}`);
    lines.push(`CLASS:${e.visibility === "private" ? "PRIVATE" : "PUBLIC"}`);
    lines.push(`TRANSP:${e.availability === "free" ? "TRANSPARENT" : "OPAQUE"}`);
    lines.push(`STATUS:${STATUS_TO_ICS[e.status] ?? "CONFIRMED"}`);

    // Remaster — export series as RRULE + EXDATE lines (system labels skipped,
    // since expandEvents never feeds them here anyway).
    if (e.recurrence?.rrule && !e.labels.some((l) => l.startsWith("series:"))) {
      for (const line of e.recurrence.rrule.split(/\r?\n/)) {
        const colon = line.indexOf(":");
        const key = colon > 0 ? line.slice(0, colon).toUpperCase() : "RRULE";
        const value = key === "EXDATE" ? line.slice(colon+1).split(",").map(x=>formatInTimeZone(new Date(x),"UTC","yyyyMMdd'T'HHmmss'Z'")).join(",") : (colon > 0 ? line.slice(colon + 1) : line);
        lines.push(`${key === "EXDATE" ? "EXDATE" : "RRULE"}:${value}`);
      }
    }

    if (e.labels.length) {
      lines.push(`CATEGORIES:${e.labels.filter(l=>!l.startsWith("tempo:")).map(icsEscape).join(",")}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ── parsing ─────────────────────────────────────────────────────────────────

/** Splits a property line into [name, params, value]; colon inside quotes is safe. */
function splitProp(line: string): { name: string; params: Record<string, string>; value: string } | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs: string[] = [];
  let seg = "";
  inQuotes = false;
  for (const ch of head) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ";" && !inQuotes) { segs.push(seg); seg = ""; }
    else seg += ch;
  }
  segs.push(seg);
  const name = (segs[0] ?? "").toUpperCase();
  const params: Record<string, string> = {};
  for (const s of segs.slice(1)) {
    const eq = s.indexOf("=");
    if (eq > 0) params[s.slice(0, eq).toUpperCase()] = s.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

const DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const DATETIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

type ParsedIcsMoment =
  | { allDay: true; civilKey: string; tz: string }          // YYYY-MM-DD civil day
  | { allDay: false; instant: string; tz: string };        // ISO instant

function parseMoment(
  raw: string,
  params: Record<string, string>,
  fallbackTz: string,
  notes: string[],
  kind: string,
): ParsedIcsMoment | null {
  if (params.VALUE?.toUpperCase() === "DATE" || DATE_RE.test(raw)) {
    const m = DATE_RE.exec(raw);
    if (!m) { notes.push(`Invalid ${kind} value ignored: ${raw}`); return null; }
    return { allDay: true, civilKey: `${m[1]}-${m[2]}-${m[3]}`, tz: fallbackTz };
  }
  const m = DATETIME_RE.exec(raw);
  if (!m) { notes.push(`Unsupported ${kind} format ignored: ${raw}`); return null; }
  if (m[7] === "Z") {
    const instant = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!));
    return { allDay: false, instant: instant.toISOString(), tz: params.TZID ?? fallbackTz };
  }
  const tz = params.TZID ?? fallbackTz;
  const instant = fromZonedTime(new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!), tz);
  return { allDay: false, instant: instant.toISOString(), tz };
}

function civilKeyAddDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n, 12));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function civilKeyToInstant(key: string, tz: string): string {
  return fromZonedTime(new Date(`${key}T00:00:00`), tz).toISOString();
}

function commitEvent(
  props: Record<string, string[]>,
  params: Record<string, Record<string, string>>,
  fallbackTz: string,
  notes: string[],
  out: IcsEvent[],
): void {
  const get = (name: string) => props[name]?.[0];
  fallbackTz = get("X-TEMPO-TIMEZONE") ?? fallbackTz;
  const title = get("SUMMARY") !== undefined ? icsUnescape(get("SUMMARY")!) : "";
  if (!title) { notes.push("Event without SUMMARY skipped"); return; }

  const startRaw = get("DTSTART");
  if (!startRaw) { notes.push(`"${title}": event without DTSTART skipped`); return; }
  const start = parseMoment(startRaw, params["DTSTART"] ?? {}, fallbackTz, notes, "DTSTART");
  if (!start) { notes.push(`"${title}": skipped (unreadable DTSTART)`); return; }

  const endRaw = get("DTEND");
  const end = endRaw ? parseMoment(endRaw, params["DTEND"] ?? {}, fallbackTz, notes, "DTEND") : null;

  let event: IcsEvent;
  if (start.allDay) {
    // DTSTART/DTEND become civil-day keys. iCal DTEND is exclusive;
    // the app keeps an inclusive last day — shift back one day.
    const lastDay =
      end === null
        ? start.civilKey
        : end.allDay
          ? civilKeyAddDays(end.civilKey, -1)
          : start.civilKey; // timed DTEND on an all-day DTSTART → single day
    const endKey = lastDay < start.civilKey ? start.civilKey : lastDay;
    if (end !== null && !end.allDay) {
      notes.push(`"${title}": timed DTEND ignored on all-day start, treated as single day`);
    }
    event = {
      title,
      startAt: civilKeyToInstant(start.civilKey, start.tz),
      endAt: civilKeyToInstant(endKey, start.tz),
      allDay: true,
      timezone: start.tz,
      categories: [],
    };
  } else {
    let endInstant: string;
    if (end && !end.allDay) {
      endInstant = end.instant;
    } else {
      notes.push(`"${title}": missing or all-day DTEND, one-hour duration applied`);
      endInstant = new Date(new Date(start.instant).getTime() + 3600_000).toISOString();
      if (new Date(endInstant) <= new Date(start.instant)) {
        endInstant = new Date(new Date(start.instant).getTime() + 3600_000).toISOString();
      }
    }
    event = { title, startAt: start.instant, endAt: endInstant, allDay: false, timezone: start.tz, categories: [] };
  }

  const statusRaw = icsUnescape(get("STATUS") ?? "CONFIRMED").toLowerCase();
  event.status = statusRaw === "tentative" ? "tentative" : statusRaw === "cancelled" ? "cancelled" : "confirmed";

  const catsRaw = get("CATEGORIES");
  const categories = catsRaw ? icsUnescape(catsRaw).split(",").map((c) => c.trim()).filter(Boolean) : [];

  // Remaster — import series as real recurrence rules (engine expands them).
  const rruleHead = get("RRULE");
  const exdateLines = (props["EXDATE"] ?? []).flatMap(line=>line.split(",")).map(value=>parseMoment(value,params["EXDATE"] ?? {},fallbackTz,notes,"EXDATE")).filter((x): x is ParsedIcsMoment => !!x).map(x=>x.allDay?civilKeyToInstant(x.civilKey,x.tz):x.instant);
  if (rruleHead) {
    event.rrule = exdateLines.length ? `${rruleHead}\nEXDATE:${exdateLines.join(",")}` : rruleHead;
    notes.push(`"${title}": recurring series imported (expanded by the app)`);
  }
  event.categories = categories.filter((c) => !c.startsWith("repetition:"));
  event.uid = get("UID");
  event.visibility=get("CLASS")==="PRIVATE"?"private":"default";
  event.availability=get("TRANSP")==="TRANSPARENT"?"free":"busy";
  if(get("RECURRENCE-ID")){const original=parseMoment(get("RECURRENCE-ID")!,params["RECURRENCE-ID"]??{},fallbackTz,notes,"RECURRENCE-ID");if(original)event.recurrenceId=original.allDay?civilKeyToInstant(original.civilKey,original.tz):original.instant;}
  if (get("DESCRIPTION") !== undefined) event.description = icsUnescape(get("DESCRIPTION")!);
  if (get("LOCATION") !== undefined) event.location = icsUnescape(get("LOCATION")!);
  out.push(event);
}

export function parseIcs(text: string, fallbackTz = "UTC"): ParseOutput {
  const notes: string[] = [];
  if(text.length>5_000_000) throw new Error("Calendar file exceeds 5 MB");
  // Unfold (RFC 5545 §3.1): CRLF followed by space/tab is a continuation.
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: IcsEvent[] = [];
  let props: Record<string, string[]> | null = null;
  let params: Record<string, Record<string, string>> = {};
  let insideTimezone = false;
  let alarmDepth=0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const upper = line.toUpperCase();
    if(upper==="BEGIN:VALARM"){alarmDepth++;continue;}
    if(upper==="END:VALARM"){alarmDepth--;continue;}
    if(alarmDepth>0) continue;
    if (upper === "BEGIN:VTIMEZONE") { insideTimezone = true; continue; }
    if (upper === "END:VTIMEZONE") { insideTimezone = false; continue; }
    if (insideTimezone) continue; // TZ offsets trusted via TZID names instead
    if (upper === "BEGIN:VEVENT") { props = {}; params = {}; continue; }
    if (upper === "END:VEVENT") {
      if (props) { try { commitEvent(props, params, fallbackTz, notes, events); } catch { notes.push("Event skipped: invalid timezone or date"); } }
      props = null;
      continue;
    }
    if (!props) continue;
    const p = splitProp(line);
    if (!p) { notes.push(`Unparsable line ignored: ${line}`); continue; }
    (props[p.name] ??= []).push(p.value);
    params[p.name] = p.params;
  }

  for(const override of events.filter(e=>e.recurrenceId)){const parent=events.find(e=>e.uid===override.uid&&e.rrule&&!e.recurrenceId);if(parent)parent.rrule=excludeOccurrence(parent.rrule!,override.recurrenceId!);else notes.push(`Override "${override.title}" has no parent in this file; imported separately.`);}
  if(text.includes("BEGIN:VALARM"))notes.push("Alarm definitions were not imported. Set reminder offsets in Tempo after import.");
  if(text.includes("ATTENDEE"))notes.push("Guest invitations were not imported or sent.");
  return { events:events.filter(e=>e.status!=="cancelled"), notes };
}
