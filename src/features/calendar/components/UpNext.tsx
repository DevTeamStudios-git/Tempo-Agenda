"use client";
import { useMemo } from "react";
import { dayKey, minutesOfDay, addDays } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import type { EventRecord, CalendarSummary } from "../types";
import { useAppI18n } from "@/lib/i18n";

function fmt(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mi = m % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (h % 12 || 12) + (mi ? ":" + pad(mi) : "") + " " + (h < 12 ? "AM" : "PM");
}

export function UpNext({
  events,
  calendars,
  timeZone,
}: {
  events: EventRecord[];
  calendars: CalendarSummary[];
  timeZone: string;
}) {
  const { locale, t } = useAppI18n();
  const next = useMemo(() => {
    const now = new Date();
    const todayKey = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
    const nowMin = minutesOfDay(now.toISOString(), timeZone);
    const upcoming = events
      .filter((e) => !e.allDay)
      .filter((e) => {
        const dk = dayKey(e.startAt, timeZone);
        if (dk > todayKey) return true;
        if (dk === todayKey) {
          const endMin = minutesOfDay(e.endAt, timeZone);
          return endMin > nowMin;
        }
        return false;
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    return upcoming ?? null;
  }, [events, timeZone]);

  if (!next) {
    return (
      <div className="card">
        <small>{t("upNext")}</small>
        <div className="n">{t("nothingComingUp")}</div>
      </div>
    );
  }
  const cal = calendars.find((c) => c.id === next.calendarId);
  const col = cal?.color ?? "var(--accent)";
  const startMin = minutesOfDay(next.startAt, timeZone);
  const endMin = minutesOfDay(next.endAt, timeZone);
  const range = `${fmt(startMin)} – ${fmt(endMin)}`;
  const now = new Date();
  const sd = new Date(next.startAt);
  const diff = Math.round((sd.getTime() - now.getTime()) / 60000);
  let when = "";
  if (diff <= 0) when = t("happeningNow");
  else if (diff < 60) when = t("inMinutes", { count: diff });
  else if (diff < 1440) when = t("inHours", { hours: Math.floor(diff / 60), minutes: diff % 60 ? ` ${diff % 60} ${t("minutesShort")}` : "" });
  else {
    const dk = dayKey(next.startAt, timeZone);
    const tomorrowKey = formatInTimeZone(addDays(now, 1, timeZone), timeZone, "yyyy-MM-dd");
    const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(new Date(next.startAt));
    when = dk === tomorrowKey ? `${t("tomorrow")}, ${fmt(startMin)}` : `${weekday}, ${fmt(startMin)}`;
  }

  return (
    <div className="card" style={{ ["--c" as string]: col } as any}>
      <div className="bar" />
      <small>{t("upNext")} · {when}</small>
      <div className="n">{next.title}</div>
      <div className="w">
        {range}
        {next.location ? ` · ${next.location}` : ""}
      </div>
    </div>
  );
}
