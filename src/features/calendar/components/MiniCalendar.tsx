"use client";
import { useMemo } from "react";
import { dayKey, startOfWeek, addDays, toInstant } from "@/lib/dates/date-utils";
import { formatInTimeZone } from "date-fns-tz";

export function MiniCalendar({
  anchor,
  timeZone,
  eventsByDate,
  onSelect,
  onPrev,
  onNext,
  selectedRange,
  selectedDateKey,
  weekStart = "monday",
}: {
  anchor: Date;
  timeZone: string;
  eventsByDate: Set<string>;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  selectedRange: [string, string];
  selectedDateKey?:string;
  weekStart?: "monday" | "sunday";
}) {
  const weekdays = weekStart === "sunday" ? ["S", "M", "T", "W", "T", "F", "S"] : ["M", "T", "W", "T", "F", "S", "S"];
  const { monthLabel, cells, todayKey } = useMemo(() => {
    const label = formatInTimeZone(anchor, timeZone, "MMMM yyyy");
    const monthKey=formatInTimeZone(anchor,timeZone,"yyyy-MM");
    const first=new Date(toInstant(monthKey+"-01",0,timeZone));
    const start=startOfWeek(first,timeZone,weekStart);
    const today=formatInTimeZone(new Date(),timeZone,"yyyy-MM-dd");
    const arr=Array.from({length:42},(_,i)=>{const date=addDays(start,i,timeZone);const iso=dayKey(date.toISOString(),timeZone);return {date,iso,isOut:iso.slice(0,7)!==monthKey};});
    return { monthLabel: label, cells: arr, todayKey: today };
  }, [anchor, timeZone, weekStart]);

  const [rs, re] = selectedRange;
  const selectedKey = selectedDateKey ?? formatInTimeZone(anchor, timeZone, "yyyy-MM-dd");

  return (
    <div className="mini">
      <div className="mini-h">
        <b>{monthLabel}</b>
        <span>
          <button className="icon" aria-label="Previous month" onClick={onPrev}>‹</button>
          <button className="icon" aria-label="Next month" onClick={onNext}>›</button>
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
