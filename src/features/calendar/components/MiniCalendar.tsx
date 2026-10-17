"use client";
import { useMemo } from "react";
import { dayKey } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";
import { useAppI18n } from "@/lib/i18n";

export function MiniCalendar({
  anchor,
  timeZone,
  eventsByDate,
  onSelect,
  onPrev,
  onNext,
  selectedRange,
  weekStart = "monday",
}: {
  anchor: Date;
  timeZone: string;
  eventsByDate: Set<string>;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  selectedRange: [string, string];
  weekStart?: "monday" | "sunday";
}) {
  const { locale, t } = useAppI18n();
  const weekdays = (weekStart === "sunday" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0]).map((weekday) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, 7 + weekday))
  );
  const { monthLabel, cells, todayKey } = useMemo(() => {
    const label = new Intl.DateTimeFormat(locale, { timeZone, month: "long", year: "numeric" }).format(anchor);
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first);
    const dow = weekStart === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
    start.setDate(1 - dow);
    const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
    const arr: { date: Date; iso: string; isOut: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = formatInTimeZone(d, timeZone, "yyyy-MM-dd");
      const isOut = formatInTimeZone(d, timeZone, "MM") !== formatInTimeZone(anchor, timeZone, "MM");
      arr.push({ date: d, iso, isOut });
    }
    return { monthLabel: label, cells: arr, todayKey: today };
  }, [anchor, timeZone, weekStart]);

  const [rs, re] = selectedRange;
  const selectedKey = formatInTimeZone(anchor, timeZone, "yyyy-MM-dd");

  return (
    <div className="mini">
      <div className="mini-h">
        <b>{monthLabel}</b>
        <span>
          <button className="icon" aria-label={t("previousMonth")} onClick={onPrev}>‹</button>
          <button className="icon" aria-label={t("nextMonth")} onClick={onNext}>›</button>
        </span>
      </div>
      <div className="mgrid">
        {weekdays.map((l, i) => (
          <div key={`${l}-${i}`} className="wd">
            {l}
          </div>
        ))}
        {cells.map(({ iso, date, isOut }) => {
          const isToday = iso === todayKey;
          const isSelected = iso === selectedKey;
          const inRange = iso >= rs && iso <= re;
          const has = eventsByDate.has(iso);
          const cls = `md${isOut ? " out" : ""}${isToday ? " today" : ""}${inRange ? " in" : ""}${isSelected ? " sel" : ""}`;
          return (
            <button key={iso} className={cls} onClick={() => onSelect(iso)} aria-label={date.toDateString()}>
              {formatInTimeZone(date, timeZone, "d")}
              {has && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
