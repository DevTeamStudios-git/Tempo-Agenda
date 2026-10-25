import {prisma} from "@/lib/prisma/client";
import { calendarRepository } from "@/server/repositories/calendar-repository";
import { assertCanManageCalendar, assertWorkspaceMember, assertCanManageCalendarsInWorkspace } from "./workspace-service";
import { toCssColorValue } from "@/lib/calendar-colors";

export async function listCalendars(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);
  const rows = await calendarRepository.listByWorkspace(workspaceId);
  // Fix: normalize stored color tokens ("work", "personal", ...) to a real
  // CSS value before they reach the client — see src/lib/calendar-colors.ts.
  return rows.map((row) => ({ ...row, color: toCssColorValue(row.color) }));
}

export async function createCalendar(userId: string, workspaceId: string, input: { name: string; color: string }) {
  // P1 §13: member may create/edit own events, but only owner/admin manage calendars
  await assertCanManageCalendarsInWorkspace(userId, workspaceId);
  const row = await calendarRepository.create(workspaceId, input);
  return { ...row, color: toCssColorValue(row.color) };
}

export async function updateCalendar(userId: string, calendarId: string, input: { name?: string; color?: string; isArchived?: boolean }) {
  await assertCanManageCalendar(userId, calendarId);
  const row = await calendarRepository.update(calendarId, input);
  return { ...row, color: toCssColorValue(row.color) };
}

export async function deleteCalendar(userId:string,calendarId:string){
 const cal=await assertCanManageCalendar(userId,calendarId);
 await prisma.$transaction(async tx=>{await tx.calendar.update({where:{id:calendarId},data:{deletedAt:new Date(),isArchived:true,isDefault:false}});if(cal.isDefault){const next=await tx.calendar.findFirst({where:{workspaceId:cal.workspaceId,deletedAt:null,isArchived:false},orderBy:{createdAt:"asc"}});if(next)await tx.calendar.update({where:{id:next.id},data:{isDefault:true}});}});
}
export async function deletedCalendars(userId:string,workspaceId:string){await assertCanManageCalendarsInWorkspace(userId,workspaceId);return prisma.calendar.findMany({where:{workspaceId,deletedAt:{not:null}},orderBy:{deletedAt:"desc"}});}
export async function restoreCalendar(userId:string,calendarId:string){const cal=await prisma.calendar.findUnique({where:{id:calendarId}});if(!cal)throw new Error("NOT_FOUND: calendar");await assertCanManageCalendarsInWorkspace(userId,cal.workspaceId);return prisma.calendar.update({where:{id:calendarId},data:{deletedAt:null,isArchived:false}});}
