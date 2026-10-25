import {synchronizeGuests} from "./invitation-service";
import { formatInTimeZone } from "date-fns-tz";
function requireCivil(iso:string,zone:string){ return formatInTimeZone(iso,zone,"yyyy-MM-dd'T'HH:mm:ss")+"Z"; }
import { expandEvents, excludeOccurrence, ruleFor } from "@/lib/recurrence/engine";
/**
 * Domain operations the UI actually calls (Construction Notebook §12).
 * The UI never imports the repository or Prisma directly — only this.
 */
import { eventRepository } from "@/server/repositories/event-repository";
import {
  assertCalendarAccess,
  assertCanCreateEvent,
  assertCanDeleteEvent,
  assertCanEditEvent,
  assertWorkspaceMember,
  assertCanWriteWorkspace,
} from "./workspace-service";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@prisma/client";
import { eventInputSchema, eventInputPartialSchema, moveOrResizeSchema, type EventInput } from "@/features/events/validation/event-schema";
import type { EventRecord } from "@/features/calendar/types";

/**
 * NOTE (Notebook v2 §4): Browser never imports Prisma; this service is the
 * authorization boundary. Supabase SSR session authenticates the request,
 * but Prisma queries run over a privileged pooled connection that bypasses RLS.
 * Hence every function here must explicitly assert membership/role before touching
 * the repository — RLS is secondary defense only.
 */

type EventRow = Prisma.EventGetPayload<{}> & { recurrenceRule?: { rrule: string } | null; attendees?: {email:string;displayName:string|null;isOptional:boolean;responseStatus:string}[]; reminders?: {userId:string;minutesBefore:number}[] };
type EventWithCalendarRow = Prisma.EventGetPayload<{ include: { calendar: true } }>;

function toRecord(row: EventRow | EventWithCalendarRow | null, userId?: string): EventRecord {
  if (!row) throw new Error("NOT_FOUND: event");
  return {
    id: row.id,
    calendarId: row.calendarId,
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    allDay: row.allDay,
    status: row.status as EventRecord["status"],
    color: row.color,
    visibility: row.visibility as EventRecord["visibility"],
    availability: row.availability as EventRecord["availability"],
    eventType: row.eventType as EventRecord["eventType"],
    conferenceUrl: row.conferenceUrl ?? "",
    recurrence: (row as EventRow).recurrenceRule ? { rrule: (row as EventRow).recurrenceRule!.rrule } : null,
    guests:(row as EventRow).attendees?.map(g=>({email:g.email,displayName:g.displayName??undefined,isOptional:g.isOptional,responseStatus:g.responseStatus})),
    reminders: (row as EventRow).reminders?.filter(r=>r.userId===userId).map(r=>r.minutesBefore),
    labels: (row.labels ?? []).filter(l=>!l.startsWith("tempo:")),
    priority: (row as any).priority ?? 2,
  };
}

export async function listEventsInRange(
  userId: string,
  workspaceId: string,
  calendarIds: string[] | undefined,
  rangeStart: Date,
  rangeEnd: Date
): Promise<EventRecord[]> {
  const membership = await assertWorkspaceMember(userId, workspaceId);
  const rows = await eventRepository.findInRange({ workspaceId, calendarIds, rangeStart, rangeEnd });
  return expandEvents(rows.map((row) => protectRecord(toRecord(row, userId),row.createdById,userId,membership.role)), rangeStart, rangeEnd);
}

export async function createEvent(userId: string, rawInput: unknown): Promise<EventRecord> {
  const input: EventInput = eventInputSchema.parse(rawInput);
  await assertCanCreateEvent(userId, input.calendarId);
  const row = await eventRepository.create(userId, input);
  return toRecord(await eventRepository.findById(row.id), userId);
}

export async function updateEvent(userId: string, eventId: string, rawInput: unknown): Promise<EventRecord> {
  const existing = await prisma.event.findUnique({ where: { id: eventId }, include: { calendar: true } });
  if (!existing || existing.calendar.deletedAt) throw new Error("NOT_FOUND: event");
  if (existing.deletedAt) throw new Error("CONFLICT: event is deleted");
  await assertCanWriteWorkspace(userId, existing.calendar.workspaceId);
  const input = eventInputPartialSchema.parse(rawInput);
  if (input.calendarId && input.calendarId !== existing.calendarId) {
    // Notebook v2 §8: forbid cross-workspace calendar moves.
    const targetCal = await prisma.calendar.findUnique({ where: { id: input.calendarId } });
    if (!targetCal) throw new Error("NOT_FOUND: calendar");
    if (targetCal.workspaceId !== existing.calendar.workspaceId) {
      throw new Error("FORBIDDEN: cannot move event to a different workspace");
    }
    await assertCanCreateEvent(userId, input.calendarId);
  }
  // Validate the complete result, including one-sided PATCHes.
  eventInputSchema.parse({ ...toRecord(existing,userId), ...input });
  await eventRepository.update(eventId, input, userId);
  return toRecord(await eventRepository.findById(eventId), userId);
}

/** Powers drag-to-move and resize — same authorization, narrower payload. */
export async function moveOrResizeEvent(userId: string, eventId: string, rawInput: unknown): Promise<EventRecord> {
  const existing = await prisma.event.findUnique({ where: { id: eventId }, include: { calendar: true } });
  if (!existing || existing.calendar.deletedAt) throw new Error("NOT_FOUND: event");
  if (existing.deletedAt) throw new Error("CONFLICT: event is deleted");
  await assertCanWriteWorkspace(userId, existing.calendar.workspaceId);
  const input = moveOrResizeSchema.parse(rawInput);
  await eventRepository.update(eventId, input);
  return toRecord(await eventRepository.findById(eventId), userId);
}

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  await assertCanDeleteEvent(userId, eventId);
  const deletedAt=new Date();
  await prisma.event.updateMany({where:{deletedAt:null,OR:[{id:eventId},{calendar:{workspaceId:(await assertCanEditEvent(userId,eventId)).calendar.workspaceId},labels:{has:"tempo:series:"+eventId}}]},data:{deletedAt}});
}

/** Undo, within the toast window — restores the same row instead of re-creating it. */
export async function restoreEvent(userId: string, eventId: string): Promise<EventRecord> {
  const existing = await prisma.event.findUnique({ where: { id: eventId }, include: { calendar: true } });
  if (!existing || existing.calendar.deletedAt) throw new Error("NOT_FOUND: event");
  // Restore must work on soft-deleted rows (deletedAt != null) and still enforce write perms.
  await assertCanWriteWorkspace(userId, existing.calendar.workspaceId);
  await prisma.event.updateMany({where:{OR:[{id:eventId},{calendar:{workspaceId:existing.calendar.workspaceId},labels:{has:"tempo:series:"+eventId},deletedAt:existing.deletedAt}]},data:{deletedAt:null}});
  return toRecord(await eventRepository.findById(eventId), userId);
}

export async function searchEvents(userId:string,workspaceId:string,query:string,calendarIds:string[]|undefined,rangeStart:Date,rangeEnd:Date):Promise<EventRecord[]> {
  const events=await listEventsInRange(userId,workspaceId,calendarIds,rangeStart,rangeEnd);
  const q=query.toLowerCase();
  return events.filter(e=>[e.title,e.description,e.location].join(" ").toLowerCase().includes(q));
}

/** Search bar's global mode — any event in the workspace, any date, not just the visible range. */
export async function searchEventsGlobal(
  userId: string,
  workspaceId: string,
  query: string,
  calendarIds: string[] | undefined,
  limit?: number
): Promise<EventRecord[]> {
  const membership = await assertWorkspaceMember(userId, workspaceId);
  const rows = await eventRepository.searchGlobal({ workspaceId, calendarIds, query, limit });
  return rows.filter(row=>!(membership.role === "viewer" && row.visibility === "private" && row.createdById!==userId)).map((row) => toRecord(row, userId));
}

export async function resetAllDayEvents(
  userId: string,
  workspaceId: string,
  calendarIds?: string[]
): Promise<{ count: number; ids: string[] }> {
  await assertCanWriteWorkspace(userId, workspaceId);
  const ids = await eventRepository.findAllDayIds(workspaceId, calendarIds);
  if (!ids.length) return { count: 0, ids: [] };
  await eventRepository.softDeleteMany(ids);
  return { count: ids.length, ids };
}

export async function restoreAllDayEvents(
  userId: string,
  workspaceId: string,
  ids: string[]
): Promise<{ count: number }> {
  if (!ids.length) return { count: 0 };
  // Verify all ids belong to workspace and user can write
  await assertCanWriteWorkspace(userId, workspaceId);
  // Extra safety: ensure ids are all-day and in workspace (optional, but we trust ids from previous reset)
  await eventRepository.restoreMany(ids);
  return { count: ids.length };
}

/** An occurrence mutation is one transaction: parent exclusion and override cannot diverge. */
export async function mutateOccurrence(userId: string, virtualId: string, raw: unknown, scope: "this" | "following" | "series", deleting = false): Promise<EventRecord | null> {
  const [parentId, original] = virtualId.split("~");
  if (!parentId || !original || !Number.isFinite(Date.parse(original))) throw new Error("BAD_REQUEST: invalid occurrence");
  const parent = await assertCanEditEvent(userId,parentId);
  const full = await eventRepository.findById(parentId);
  const record = toRecord(full,userId);
  if(!record.recurrence) throw new Error("CONFLICT: series no longer exists");
  const at=new Date(original);
  const occurrence=expandEvents([record],at,new Date(+at+1)).find(e=>e.startAt===at.toISOString());
  if(!occurrence) throw new Error("CONFLICT: occurrence no longer exists");
  const patch=eventInputPartialSchema.parse(raw ?? {});
  if(patch.calendarId && patch.calendarId!==record.calendarId) {
    const target=await assertCanCreateEvent(userId,patch.calendarId);
    if(target.workspaceId!==parent.calendar.workspaceId) throw new Error("FORBIDDEN: cannot move across workspaces");
  }
  const draft=eventInputSchema.parse({...occurrence,...patch});
  const marker="tempo:series:"+parentId;
  const atMarker="tempo:at:"+at.toISOString();
  const result=await prisma.$transaction(async tx=>{
    // Lock the master so simultaneous edits cannot lose another EXDATE.
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${parentId} FOR UPDATE`;
    const current=await tx.recurrenceRule.findUnique({where:{eventId:parentId}});
    if(!current) throw new Error("CONFLICT: series changed");
    if(!expandEvents([{...record,recurrence:{rrule:current.rrule}}],at,new Date(+at+1)).some(e=>e.startAt===at.toISOString())) throw new Error("CONFLICT: occurrence was already changed; refresh and try again");
    if(scope==="series") {
      if(deleting) { await tx.event.updateMany({where:{deletedAt:null,OR:[{id:parentId},{calendar:{workspaceId:parent.calendar.workspaceId},labels:{has:marker}}]},data:{deletedAt:new Date()}}); return null; }
      const delta=Date.parse(draft.startAt)-Date.parse(occurrence.startAt);
      const duration=Date.parse(draft.endAt)-Date.parse(draft.startAt);
      const {recurrence,reminders,guests,...fields}=draft;
      const startAt=new Date(Date.parse(record.startAt)+delta);
      const row=await tx.event.update({where:{id:parentId},data:{...fields,startAt,endAt:new Date(+startAt+duration)}});
      if(recurrence===null) await tx.recurrenceRule.delete({where:{eventId:parentId}});
      else await tx.recurrenceRule.update({where:{eventId:parentId},data:{rrule:recurrence?.rrule ?? current.rrule,timezone:row.timezone,dtstart:row.startAt}});
      if(guests)await synchronizeGuests(tx,row.id,guests);
      if(reminders){await tx.reminder.deleteMany({where:{eventId:row.id,userId}});await tx.reminder.createMany({data:reminders.map(minutesBefore=>({eventId:row.id,userId,minutesBefore}))});}
      return row.id;
    }
    if(scope==="following") {
      const opts=ruleFor(record).origOptions;
      const head=current.rrule.split("\n")[0]!.replace(/;COUNT=\d+/g,"").replace(/;UNTIL=[^;]+/g,"");
      const until=new Date(+at-1000).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
      await tx.recurrenceRule.update({where:{eventId:parentId},data:{rrule:head+";UNTIL="+until+ (current.rrule.includes("\n") ? "\n"+current.rrule.split("\n").slice(1).join("\n") : "")}});
      const overrides=await tx.event.findMany({where:{calendar:{workspaceId:parent.calendar.workspaceId},labels:{has:marker},deletedAt:null},select:{id:true,labels:true}});
      const followingIds=overrides.filter(o=>{const original=o.labels.find(l=>l.startsWith("tempo:at:"))?.slice(9);return original&&Date.parse(original)>=+at;}).map(o=>o.id);
      if(followingIds.length)await tx.event.updateMany({where:{id:{in:followingIds}},data:{deletedAt:new Date()}});
      if(deleting) return null;
      let nextRule=draft.recurrence?.rrule ?? current.rrule;
      if(opts.count && draft.recurrence?.rrule===current.rrule) {
        // Preserve the remaining number of scheduled occurrences when splitting.
        const before=ruleFor(record).all((date)=> date.getTime() < new Date(requireCivil(at.toISOString(),record.timezone)).getTime()).length;
        nextRule=nextRule.replace(/COUNT=\d+/,"COUNT="+Math.max(1,opts.count-before));
      }
      const {recurrence,reminders,guests,...fields}=draft;
      const row=await tx.event.create({data:{...fields,createdById:userId,startAt:new Date(draft.startAt),endAt:new Date(draft.endAt),
        recurrenceRule:recurrence===null?undefined:{create:{rrule:nextRule,timezone:draft.timezone,dtstart:new Date(draft.startAt)}}}});
      if(guests)await synchronizeGuests(tx,row.id,guests);
      if(reminders)await tx.reminder.createMany({data:reminders.map(minutesBefore=>({eventId:row.id,userId,minutesBefore}))});
      return row.id;
    }
    await tx.recurrenceRule.update({where:{eventId:parentId},data:{rrule:excludeOccurrence(current.rrule,at.toISOString())}});
    if(deleting) return null;
    const {recurrence,reminders,guests,...fields}=draft;
    const row=await tx.event.create({data:{...fields,labels:[...draft.labels.filter(l=>!l.startsWith("tempo:")),marker,atMarker],createdById:userId,startAt:new Date(draft.startAt),endAt:new Date(draft.endAt),
      reminders:reminders?{create:reminders.map(minutesBefore=>({userId,minutesBefore}))}:undefined}});
    if(guests)await synchronizeGuests(tx,row.id,guests);
    return row.id;
  });
  return result?toRecord(await eventRepository.findById(result),userId):null;
}

function protectRecord(record:EventRecord,creatorId:string,userId:string,role:string):EventRecord {
  if(record.visibility!=="private" || creatorId===userId || role!=="viewer") return record;
  return {...record,title:"Busy",description:"",location:"",conferenceUrl:"",labels:[],reminders:[],guests:[]};
}

export async function exportCalendarEvents(userId:string,workspaceId:string,calendarIds:string[]|undefined,rangeStart:Date,rangeEnd:Date) {
  const m=await assertWorkspaceMember(userId,workspaceId);
  const rows=await eventRepository.findInRange({workspaceId,calendarIds,rangeStart,rangeEnd});
  return rows.map(row=>protectRecord(toRecord(row,userId),row.createdById,userId,m.role));
}
export async function listTrash(userId:string,workspaceId:string) {
  await assertCanWriteWorkspace(userId,workspaceId);
  const rows=await prisma.event.findMany({where:{calendar:{workspaceId,deletedAt:null},deletedAt:{not:null}},orderBy:{deletedAt:"desc"},take:200});
  return rows.map(row=>toRecord(row,userId));
}
