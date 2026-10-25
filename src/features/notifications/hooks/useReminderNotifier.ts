"use client";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";
import type { EventRecord } from "@/features/calendar/types";

function playRingstone() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

export function useReminderNotifier(events: EventRecord[], workspaceId: string) {
  const { settings } = useSettings();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings.pushNotifications && !settings.emailNotifications) return;
    // Load fired from sessionStorage to avoid repeat across reloads
    try {
      const raw = sessionStorage.getItem("tempo-fired-reminders");
      if (raw) firedRef.current = new Set(JSON.parse(raw));
    } catch {}

    const check = async () => {
      const now = Date.now();
      for (const ev of events) {
        if (ev.allDay) continue;
        const start = new Date(ev.startAt).getTime();
        // Default reminder 15 min before, or from settings
        const mins = ev.reminders ?? [15];
        for (const m of mins) {
          const triggerAt = start - m * 60 * 1000;
          const windowEnd = triggerAt + 60 * 1000; // 1 min window
          if (now >= triggerAt && now < windowEnd) {
            const key = `${ev.id}-${m}`;
            if (firedRef.current.has(key)) continue;
            firedRef.current.add(key);
            try {
              sessionStorage.setItem("tempo-fired-reminders", JSON.stringify([...firedRef.current]));
            } catch {}

            // In-app notification via API (creates DB row, shows in bell)
            try {
              await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  type: "event_reminder",
                  title: `Upcoming: ${ev.title}`,
                  body: `Starts in ${m} minutes${ev.location ? ` · ${ev.location}` : ""}`,
                  eventId: ev.occurrenceOf?.seriesId ?? ev.id,
                  reminderAt:ev.startAt, minutesBefore:m,
                }),
              }).catch(() => {});
            } catch {}

            // Browser push / lock-screen (if granted)
            if (settings.pushNotifications && "Notification" in window && Notification.permission === "granted") {
              new Notification(`Upcoming: ${ev.title}`, {
                body: `Starts in ${m} minutes${ev.location ? ` · ${ev.location}` : ""}`,
                icon: "/icon-192.png",
                tag: key,
              });
            } else if (settings.pushNotifications && "Notification" in window && Notification.permission !== "denied") {
              Notification.requestPermission();
            }

            // Ringstone if enabled (use Web Audio)
            playRingstone();

            // Also dispatch a custom event for the bell to refetch
            window.dispatchEvent(new CustomEvent("tempo-notification-new"));
          }
        }
      }
    };

    const id = window.setInterval(check, 30000); // every 30s
    check();
    return () => window.clearInterval(id);
  }, [events, workspaceId, settings.pushNotifications, settings.emailNotifications]);
}
