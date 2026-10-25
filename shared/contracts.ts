/** Shared domain types — UI knows these, not Prisma/Postgres shapes. */

export type CalendarView =
  "day" | "week" | "month" | "agenda" | "book" | "year" | "notebook";

export interface CalendarSummary {
  id: string;
  name: string;
  /** design-token color name ("work" | "personal" | ...) or a hex value */
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  deletedAt?: string | null;
}

export type EventStatus = "confirmed" | "tentative" | "cancelled";

export interface EventRecord {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  /** ISO 8601 instants — always UTC on the wire, formatted per `timezone` in the UI */
  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;
  recurrence?: { rrule: string } | null;
  occurrenceOf?: { seriesId: string; originalStartAt: string };
  color?: string | null;
  visibility?: "default" | "private" | "public";
  availability?: "busy" | "free";
  eventType?: "event" | "focus" | "outOfOffice" | "workingLocation";
  conferenceUrl?: string;
  reminders?: number[];
  guests?: Array<{
    email: string;
    displayName?: string;
    isOptional?: boolean;
    responseStatus?: string;
  }>;

  status: EventStatus;
  /** Free‑form tags / categories for organizing events */
  labels: string[];
  /** Numeric priority: 1 = low, 2 = medium (default), 3 = high */
  priority?: number;
}

export interface EventDraft {
  editScope?: "this" | "following" | "series";
  id?: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;
  recurrence?: { rrule: string } | null;
  occurrenceOf?: { seriesId: string; originalStartAt: string };
  color?: string | null;
  visibility?: "default" | "private" | "public";
  availability?: "busy" | "free";
  eventType?: "event" | "focus" | "outOfOffice" | "workingLocation";
  conferenceUrl?: string;
  reminders?: number[];
  guests?: Array<{
    email: string;
    displayName?: string;
    isOptional?: boolean;
    responseStatus?: string;
  }>;

  /** Free‑form tags / categories for organizing events */
  labels?: string[];
  /** Numeric priority: 1 = low, 2 = medium (default), 3 = high */
  priority?: number;
}

/** Result of the overlap-layout algorithm for one day's non-all-day events. */
export interface LaidOutEvent {
  event: EventRecord;
  column: number;
  columnCount: number;
}

export interface AssistantPermissions {
  canRead: boolean;
  canCreateEvents: boolean;
  canEditEvents: boolean;
  canDeleteEvents: boolean;
  canCreateCalendars: boolean;
  canManageCalendars: boolean;
}
export interface AssistantAction {
  name: string;
  arguments: Record<string, unknown>;
  summary: string;
}
export interface AssistantPlanView {
  id: string;
  actions: AssistantAction[];
  state: string;
  results?: Array<{ ok: boolean; message: string }>;
}
export interface SessionBootstrap {
  user: { id: string; email?: string; displayName: string };
  workspaceId: string;
  timeZone: string;
  calendars: CalendarSummary[];
  canManageCalendars: boolean;
}
