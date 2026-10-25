import { useEffect, useState } from "react";

export type WeekStart = "monday" | "sunday";
export type TimeFormat = "12h" | "24h";

export type AiProvider = "groq" | "openrouter" | "together";

export interface AiPermissions {
  canRead: boolean;
  canCreateEvents: boolean;
  canEditEvents: boolean;
  canDeleteEvents: boolean;
  canCreateCalendars: boolean;
  canManageCalendars: boolean;
}

export interface UserSettings {
  workingStart:number;
  workingEnd:number;
  secondaryTimezone:string;
  timezone: string;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  defaultCalendarId: string | null;
  defaultDuration: number; // minutes
  showWeekends: boolean;
  showPastEvents: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  density: "comfortable" | "compact";
  // AI
  aiEnabled: boolean;
  aiProvider: AiProvider;
  aiModel: string;
  aiProviderKeys?:Partial<Record<AiProvider,string>>;
  aiApiKey: string; // stored locally, full key without prefix
  aiKeyPrefix: string; // shown before input, from env or user
  aiPermissions: AiPermissions;
  aiVisionEnabled: boolean; // allow image attachments
}

export { AI_MODELS, AI_DEFAULT_MODEL, AI_KEY_PREFIXES } from "./ai/catalog";
import { AI_MODELS, AI_DEFAULT_MODEL, AI_KEY_PREFIXES } from "./ai/catalog";

const KEY = "tempo-settings";

const DEFAULTS: UserSettings = {
  workingStart:540, workingEnd:1020, secondaryTimezone:"UTC",
  timezone: "America/Toronto",
  weekStart: "monday",
  timeFormat: "12h",
  defaultCalendarId: null,
  defaultDuration: 60,
  showWeekends: true,
  showPastEvents: true,
  emailNotifications: true,
  pushNotifications: false,
  density: "comfortable",
  aiEnabled: false,
  aiProvider: "groq",
  aiModel: AI_DEFAULT_MODEL.groq,
  aiApiKey: "",
  aiKeyPrefix: AI_KEY_PREFIXES.groq,
  aiPermissions: {
    canRead: true,
    canCreateEvents: true,
    canEditEvents: true,
    canDeleteEvents: false,
    canCreateCalendars: true,
    canManageCalendars: false,
  },
  aiVisionEnabled: true,
};

const DEPRECATED_MODELS=new Set(["gemma2-9b-it","llama-3.1-8b-instant","llama-3.3-70b-versatile","llama-3.1-70b-versatile","qwen-2.5-32b-instruct","mixtral-8x7b-32768","llama-3.2-11b-vision-preview","llama-3.2-90b-vision-preview"]);

export function getSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UserSettings> & { aiProvider?: string };
    // migrate old provider "custom" -> "groq"
    let prov = (parsed.aiProvider as AiProvider) || DEFAULTS.aiProvider;
    if ((prov as string) === "custom") prov = "groq";
    if (!AI_MODELS[prov]) prov = "groq";
    // Preserve dynamically discovered model IDs; migrate known retired choices.
    const mdl = !parsed.aiModel || DEPRECATED_MODELS.has(parsed.aiModel) ? AI_DEFAULT_MODEL[prov] : parsed.aiModel;
    const merged: UserSettings = { ...DEFAULTS, ...parsed, aiProvider: prov, aiModel: mdl, aiPermissions: { ...DEFAULTS.aiPermissions, ...parsed.aiPermissions } };
    // also fix prefix if it doesn't match provider
    if (merged.aiKeyPrefix === "gsk_" && prov !== "groq") merged.aiKeyPrefix = AI_KEY_PREFIXES[prov];
    if (merged.aiKeyPrefix !== AI_KEY_PREFIXES[prov] && parsed.aiProvider !== prov) {
      merged.aiKeyPrefix = AI_KEY_PREFIXES[prov];
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<UserSettings>) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep preferences in memory if browser storage is unavailable. */ }
  // Dispatch event so other hooks update
  window.dispatchEvent(new CustomEvent("tempo-settings-changed", { detail: next }));
  return next;
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(getSettings());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as UserSettings | undefined;
      setSettings(detail ?? getSettings());
    };
    const storageHandler = () => setSettings(getSettings());
    window.addEventListener("tempo-settings-changed", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("tempo-settings-changed", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const update = (patch: Partial<UserSettings>) => {
    const next = saveSettings(patch);
    setSettings(next);
  };

  return { settings, update, defaults: DEFAULTS };
}

export const TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Africa/Casablanca",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
];
