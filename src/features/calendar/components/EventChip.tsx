"use client";
import { formatClock } from "@/lib/dates/date-utils";
import type { EventRecord } from "../types";

function PriorityBullets({ priority }: { priority: number }) {
  if (!priority) return null;
  const bulbs = [];
  for (let i = 1; i <= 3; i++) {
    const filled = i <= priority;
    bulbs.push(
      <svg
        key={i}
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path d="M12 3l5 9-5 9" />
      </svg>
    );
  }
  return <span className="priority-bullets">{bulbs}</span>;
}

function LabelsChip({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <span className="labels-chip">
      {labels.map((l, i) => (
        <span
          key={l}
          className="label-chip"
          style={{ borderColor: `var(--${l}-color, var(--accent))` }}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

export function EventChip({
  event, timeZone, colorVar, onSelect,
}: { event: EventRecord; timeZone: string; colorVar: string; onSelect: (id: string) => void }) {
  return (
    <button
      className="chip"
      style={{ ["--c" as string]: event.color ?? colorVar }}
      onClick={() => onSelect(event.id)}
    >
      {!event.allDay && <b>{formatClock(event.startAt, timeZone)} </b>}
      <span className="ti">{event.title}</span>
      {event.labels && event.labels.length > 0 && <LabelsChip labels={event.labels} />}
      {event.priority ? <PriorityBullets priority={event.priority} /> : null}
    </button>
  );
}
