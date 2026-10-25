import {reminderId} from "./reminder-service";
import {prisma} from "@/lib/prisma/client";
import {z} from "zod";
import { notificationRepository } from "@/server/repositories/notification-repository";
import { assertWorkspaceMember } from "./workspace-service";

export async function listNotifications(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);
  const [items, unread] = await Promise.all([
    notificationRepository.listForUser(userId, workspaceId),
    notificationRepository.countUnread(userId, workspaceId),
  ]);
  return { items, unread };
}

export async function markNotificationRead(userId: string, workspaceId: string, id: string) {
  await assertWorkspaceMember(userId, workspaceId);
  await notificationRepository.markRead(id, userId);
}

export async function markAllNotificationsRead(userId: string, workspaceId: string) {
  await assertWorkspaceMember(userId, workspaceId);
  await notificationRepository.markAllRead(userId, workspaceId);
}

export async function createNotification(
  userId: string,
  workspaceId: string,
  data: { type: string; title: string; body?: string; eventId?: string;reminderAt?:string;minutesBefore?:number }
) {
  await assertWorkspaceMember(userId,workspaceId);
  const parsed=z.object({type:z.enum(["event_reminder","event_invite","event_update","system"]),title:z.string().min(1).max(300),body:z.string().max(2000).optional(),eventId:z.string().optional(),reminderAt:z.string().datetime().optional(),minutesBefore:z.number().int().min(0).max(40320).optional()}).parse(data);
  if(parsed.eventId){const event=await prisma.event.findFirst({where:{id:parsed.eventId,calendar:{workspaceId}}});if(!event)throw new Error("NOT_FOUND: event");}
  const {reminderAt,minutesBefore,...fields}=parsed;
  if(reminderAt!==undefined&&minutesBefore!==undefined&&parsed.eventId){const id=reminderId(userId,parsed.eventId,reminderAt,minutesBefore);return prisma.notification.upsert({where:{id},create:{id,userId,workspaceId,...fields},update:{}});}
  return notificationRepository.create({ userId, workspaceId, ...fields });
}

// Helper to create reminder notifications (called by reminder service / cron)
export async function createReminderNotification(userId: string, workspaceId: string, eventId: string, title: string, minutesBefore: number) {
  return createNotification(userId, workspaceId, {
    type: "event_reminder",
    title: `Upcoming: ${title}`,
    body: `Starts in ${minutesBefore} minutes`,
    eventId,
  });
}
