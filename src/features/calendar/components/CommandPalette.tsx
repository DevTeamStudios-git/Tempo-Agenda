"use client";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/lib/icons";
import { useAppI18n } from "@/lib/i18n";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const { t } = useAppI18n();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(s) ||
      c.hint?.toLowerCase().includes(s) ||
      c.keywords?.some(k => k.toLowerCase().includes(s))
    );
  }, [q, commands]);

  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;

  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label={t("commandPaletteTitle")}>
        <div className="cmd-head">
          <SearchIcon size={16} style={{ color: "var(--muted)" }} />
          <input
            autoFocus
            placeholder={t("whatDoYouWant")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.action(); onClose(); }
            }}
          />
          <span className="cmd-esc">ESC</span>
        </div>
        <div className="cmd-list">
          {filtered.length === 0 && <div className="cmd-empty">{t("noCommands", { query: q })}</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              className={`cmd-row${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => { c.action(); onClose(); }}
            >
              {c.icon && <span style={{ width: 20, display: "grid", placeItems: "center", flex: "none" }}>{c.icon}</span>}
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.hint && <span className="cmd-hint">{c.hint}</span>}
            </button>
          ))}
        </div>
        <div className="cmd-foot">↑↓ {t("navigate")} · Enter {t("select")} · Esc {t("escClose")} · ⌘K {t("toggle")}</div>
      </div>
    </div>
  );
}
