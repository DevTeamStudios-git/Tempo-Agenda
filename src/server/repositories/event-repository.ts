import {synchronizeGuests} from "@/server/services/invitation-service";
/**
 * Data access only. No authorization decisions live here — the service layer
 * decides *whether* a query is allowed; the repository just runs it, always
 * scoped to a workspace_id so one tenant can never see another's rows.
 *
 * Notebook v2 §31: prefer workspace-scoped lookups to reduce chance of
 * an unscoped findById leaking across tenants. The service enforces this.
 */
import { prisma } from "@/lib/prisma/client";
import type { EventInput } from "@/features/events/validation/event-schema";

export interface EventRangeQuery {
  workspaceId: string;
  calendarIds?: string[];
  rangeStart: Date;
  rangeEnd: Date;
}

export interface EventSearchQuery extends EventRangeQuery {
  query: string;
}

export const eventRepository = {
  // Notebook v3 §3.6: half-open [rangeStart, rangeEnd) — avoid boundary duplication
  async findInRange({ workspaceId, calendarIds, rangeStart, rangeEnd }: EventRangeQuery) {
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        startAt: { lt: rangeEnd },
        AND: [{ OR: [{ endAt: { gt: rangeStart } }, { allDay: true, endAt: { gte: rangeStart } }, { recurrenceRule: { isNot: null } }] }],
        calendar: {
          workspaceId,deletedAt:null,
          ...(calendarIds && calendarIds.length > 0 ? { id: { in: calendarIds } } : calendarIds && calendarIds.length === 0 ? { id: { in: [] } } : {}),
        },
      },
      include: { recurrenceRule: true, reminders: true, attendees:true },
      orderBy: { startAt: "asc" },
    });
  },

  /** Server-side search (Notebook v2 §17): indexed where possible, covers title/description/location. */
  async searchInRange({ workspaceId, calendarIds, rangeStart, rangeEnd, query }: EventSearchQuery) {
    const q = query.trim();
    if (!q) return this.findInRange({ workspaceId, calendarIds, rangeStart, rangeEnd });
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        startAt: { lt: rangeEnd },
        AND: [{ OR: [{ endAt: { gt: rangeStart } }, { allDay: true, endAt: { gte: rangeStart } }, { recurrenceRule: { isNot: null } }] }],
        calendar: {
          workspaceId,deletedAt:null,
          ...(calendarIds && calendarIds.length > 0 ? { id: { in: calendarIds } } : calendarIds && calendarIds.length === 0 ? { id: { in: [] } } : {}),
        },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { recurrenceRule: true, reminders: true, attendees:true },
      orderBy: { startAt: "asc" },
    });
  },

  /**
   * Global search (not range-limited) — powers the header search bar's
   * "Events" results, so a match next month or last year is still found.
   * Ordered by absolute distance from `now` so nearby events surface first.
   */
  async searchGlobal({ workspaceId, calendarIds, query, limit = 20 }: { workspaceId: string; calendarIds?: string[]; query: string; limit?: number }) {
    const q=query.trim();if(!q)return [];
    const where={deletedAt:null,calendar:{workspaceId,deletedAt:null,...(calendarIds?{id:{in:calendarIds}}:{})},OR:[{title:{contains:q,mode:"insensitive" as const}},{description:{contains:q,mode:"insensitive" as const}},{location:{contains:q,mode:"insensitive" as const}}]};
    const now=new Date(),take=Math.max(1,Math.min(50,Math.floor(limit)));
    const [future,past]=await Promise.all([
      prisma.event.findMany({where:{...where,startAt:{gte:now}},include:{recurrenceRule:true,reminders:true,attendees:true},orderBy:{startAt:"asc"},take}),
      prisma.event.findMany({where:{...where,startAt:{lt:now}},include:{recurrenceRule:true,reminders:true,attendees:true},orderBy:{startAt:"desc"},take}),
    ]);
    return [...future,...past].sort((a,b)=>Math.abs(+a.startAt-+now)-Math.abs(+b.startAt-+now)).slice(0,take);
  },

  async findById(id: string) {
    return prisma.event.findUnique({ where: { id }, include: { calendar: true, recurrenceRule: true, reminders: true, attendees:true } });
  },

  async findByIdInWorkspace(workspaceId: string, id: string) {
    return prisma.event.findFirst({ where: { id, calendar: { workspaceId } }, include: { calendar: true, recurrenceRule: true, reminders: true, attendees:true } });
  },

  async create(createdById: string, input: EventInput) {
    const { recurrence, reminders, guests, ...fields } = input;
    return prisma.$transaction(async tx=>{const row=await tx.event.create({
      data: {
        ...fields, createdById, startAt: new Date(input.startAt), endAt: new Date(input.endAt),
        recurrenceRule: recurrence ? { create: { rrule: recurrence.rrule, timezone: input.timezone, dtstart: new Date(input.startAt) } } : undefined,
        reminders: reminders ? { create: reminders.map(minutesBefore=>({userId:createdById,minutesBefore,channel:"in_app" as const})) } : undefined,
      }, include: { recurrenceRule: true, reminders: true, attendees:true },
    });
    if(guests)await synchronizeGuests(tx,row.id,guests);
    return tx.event.findUniqueOrThrow({where:{id:row.id},include:{recurrenceRule:true,reminders:true,attendees:true}});
    });
  },
  async update(id: string, input: Partial<EventInput>, userId?: string) {
    const { recurrence, reminders, guests, ...fields } = input;
    return prisma.$transaction(async tx => {
      const row = await tx.event.update({ where:{id}, data:{...fields,
        startAt:input.startAt ? new Date(input.startAt):undefined,
        endAt:input.endAt ? new Date(input.endAt):undefined,
      }});
      if(guests)await synchronizeGuests(tx,id,guests);
      if(recurrence === null) await tx.recurrenceRule.deleteMany({where:{eventId:id}});
      else if(recurrence) await tx.recurrenceRule.upsert({where:{eventId:id},create:{eventId:id,rrule:recurrence.rrule,timezone:row.timezone,dtstart:row.startAt},update:{rrule:recurrence.rrule,timezone:row.timezone,dtstart:row.startAt}});
      else if(input.startAt || input.timezone) await tx.recurrenceRule.updateMany({where:{eventId:id},data:{timezone:row.timezone,dtstart:row.startAt}});
      if(reminders && userId) {
        await tx.reminder.deleteMany({where:{eventId:id,userId}});
        await tx.reminder.createMany({data:reminders.map(minutesBefore=>({eventId:id,userId,minutesBefore,channel:"in_app" as const}))});
      }
      return tx.event.findUniqueOrThrow({where:{id},include:{recurrenceRule:true,reminders:true,attendees:true}});
    });
  },

  /** Soft delete — keeps the row so Undo can restore it without re-creating it. */
  async softDelete(id: string) {
    return prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async restore(id: string) {
    return prisma.event.update({ where: { id }, data: { deletedAt: null } });
  },

  async findAllDayIds(workspaceId: string, calendarIds?: string[]): Promise<string[]> {
    const rows = await prisma.event.findMany({
      where: {
        deletedAt: null,
        allDay: true,
        calendar: {
          workspaceId,deletedAt:null,
          ...(calendarIds && calendarIds.length > 0 ? { id: { in: calendarIds } } : calendarIds && calendarIds.length === 0 ? { id: { in: [] } } : {}),
        },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async softDeleteMany(ids: string[]) {
    if (!ids.length) return { count: 0 };
    return prisma.event.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: new Date() } });
  },

  async restoreMany(ids: string[]) {
    if (!ids.length) return { count: 0 };
    return prisma.event.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  },
};
