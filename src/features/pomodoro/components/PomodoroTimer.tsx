"use client";
import { useEffect, useRef, useState } from "react";
import { useAppI18n } from "@/lib/i18n";

type Mode = "work" | "shortBreak" | "longBreak";

const PRESET_MINUTES: Record<Mode, number> = { work: 25, shortBreak: 5, longBreak: 15 };

function usePomodoroPresets() {
  const { t } = useAppI18n();
  return {
    work: { label: t("focus"), minutes: PRESET_MINUTES.work, color: "var(--accent)" },
    shortBreak: { label: t("break"), minutes: PRESET_MINUTES.shortBreak, color: "var(--health)" },
    longBreak: { label: t("longBreak"), minutes: PRESET_MINUTES.longBreak, color: "var(--personal)" },
  } as const;
}



export function PomodoroTimer() {
  const { t } = useAppI18n();
  const PRESETS: Record<Mode, { label: string; minutes: number; color: string }> = usePomodoroPresets();
  const [mode, setMode] = useState<Mode>("work");
  const [custom, setCustom] = useState<Record<Mode, number>>({
    work: 25,
    shortBreak: 5,
    longBreak: 15,
  });
  const [secondsLeft, setSecondsLeft] = useState(PRESETS.work.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Sync seconds when mode/custom changes and not running
  useEffect(() => {
    if (!isRunning) setSecondsLeft(custom[mode] * 60);
  }, [mode, custom, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          // Auto-switch
          if (mode === "work") {
            const nextCompleted = completed + 1;
            setCompleted(nextCompleted);
            const nextMode: Mode = nextCompleted % 4 === 0 ? "longBreak" : "shortBreak";
            setMode(nextMode);
            setSecondsLeft(custom[nextMode] * 60);
            setIsRunning(false);
            // gentle notification
            try {
              new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==").play().catch(() => {});
              if ("Notification" in window && Notification.permission === "granted") new Notification("Pomodoro", { body: `${PRESETS[mode].label} done — ${PRESETS[nextMode].label} next` });
            } catch {}
            return custom[nextMode] * 60;
          } else {
            setMode("work");
            return custom.work * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, completed, custom]);

  const total = custom[mode] * 60;
  const progress = total ? 1 - secondsLeft / total : 0;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ font: "700 13px var(--font-display)", color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRESETS[mode].color, display: "inline-block" }} />
          Pomodoro
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--hover)", padding: "4px 8px", borderRadius: 20 }}>
          {completed} {t("done")}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["work", "shortBreak", "longBreak"] as Mode[]).map((k) => (
          <button
            key={k}
            onClick={() => { setMode(k); setIsRunning(false); }}
            style={{
              flex: 1,
              height: 30,
              borderRadius: 20,
              border: k === mode ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: k === mode ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "transparent",
              color: k === mode ? "var(--accent)" : "var(--muted)",
              fontWeight: 700,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {PRESETS[k].label}
          </button>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "6px 0 8px" }}>
        <div style={{ font: "700 36px/1 var(--font-display)", letterSpacing: "-.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {pad(m)}:{pad(s)}
        </div>
        <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden", marginTop: 10 }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: PRESETS[mode].color, transition: "width 1s linear" }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>
          {PRESETS[mode].label} · {custom[mode]} {t("minutesShort")}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => setIsRunning((v) => !v)}
          className="btn primary"
          style={{ flex: 1, justifyContent: "center", height: 36, borderRadius: 12 }}
        >
          {isRunning ? t("pause") : t("start")}
        </button>
        <button
          onClick={() => { setIsRunning(false); setSecondsLeft(custom[mode] * 60); }}
          className="btn"
          style={{ height: 36, borderRadius: 12 }}
        >
          Reset
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            if (mode === "work") {
              const next: Mode = (completed + 1) % 4 === 0 ? "longBreak" : "shortBreak";
              setMode(next);
            } else setMode("work");
          }}
          className="btn ghost"
          style={{ height: 36, borderRadius: 12 }}
          title={t("skip")}
        >
          Skip
        </button>
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", cursor: "pointer", listStyle: "none" }}>{t("customize")}</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          {(["work", "shortBreak", "longBreak"] as Mode[]).map((k) => (
            <label key={k} style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
              {PRESETS[k].label}
              <input
                type="number"
                min={1}
                max={60}
                value={custom[k]}
                onChange={(e) => setCustom((c) => ({ ...c, [k]: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))}
                style={{ width: "100%", marginTop: 4, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", padding: "0 8px", fontWeight: 600 }}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
