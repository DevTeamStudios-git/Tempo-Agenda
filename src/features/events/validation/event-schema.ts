import { z } from "zod";
import { validateRule } from "@/lib/recurrence/engine";

/**
 * Shared client+server validation. The server re-validates every mutation —
 * client validation is only for fast feedback, never treated as proof.
 */
const eventInputBase = z.object({
  calendarId: z.string().min(1, "Choose a calendar"),
  title: z.string().trim().min(1, "Add a title").max(200),
  description: z.string().max(5000).optional().default(""),
  location: z.string().max(300).optional().default(""),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone"),
  recurrence: z.object({ rrule: z.string().max(2000).refine(validateRule, "Invalid or unsupported recurrence rule") }).nullable().optional(),
  guests: z.array(z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),displayName:z.string().max(100).optional(),isOptional:z.boolean().optional()})).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  visibility: z.enum(["default","private","public"]).default("default"),
  availability: z.enum(["busy","free"]).default("busy"),
  eventType: z.enum(["event","focus","outOfOffice","workingLocation"]).default("event"),
  conferenceUrl: z.union([z.literal(""),z.string().url().refine(v=>v.startsWith("https://"),"Use an HTTPS meeting link")]).optional(),
  reminders: z.array(z.number().int().min(0).max(40320)).max(5).optional(),
  allDay: z.boolean().default(false),
  /** Free‑form tags / categories for organizing events */
  labels: z.array(z.string().trim().min(1).max(80).refine(l=>!l.startsWith("tempo:"),"Reserved label prefix")).max(30).default([]),
  /** Numeric priority: 1 = low, 2 = medium (default), 3 = high */
  priority: z.number().int().min(1).max(3).default(2),
});

export const eventInputSchema = eventInputBase
  .refine((v) => (v.allDay ? new Date(v.endAt) >= new Date(v.startAt) : new Date(v.endAt) > new Date(v.startAt)), {
    message: "End time must be after the start time",
    path: ["endAt"],
  });

// Zod 4 applies defaults even within optional fields. PATCH must preserve omitted fields.
export const eventInputPartialSchema = z.unknown().transform((raw,ctx):Partial<z.infer<typeof eventInputBase>>=>{
  const result=eventInputBase.partial().safeParse(raw);
  if(!result.success){for(const issue of result.error.issues)ctx.addIssue({code:"custom",path:issue.path,message:issue.message});return z.NEVER;}
  const source=raw as Record<string,unknown>;
  return Object.fromEntries(Object.entries(result.data).filter(([key])=>Object.prototype.hasOwnProperty.call(source,key)));
}).refine(v=>!v.startAt||!v.endAt||(v.allDay?new Date(v.endAt)>=new Date(v.startAt):new Date(v.endAt)>new Date(v.startAt)),{message:"End time must be after start",path:["endAt"]});

export type EventInput = z.infer<typeof eventInputSchema>;

export const moveOrResizeSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
}).refine((v) => new Date(v.endAt) > new Date(v.startAt), {
  message: "End time must be after the start time",
  path: ["endAt"],
});
