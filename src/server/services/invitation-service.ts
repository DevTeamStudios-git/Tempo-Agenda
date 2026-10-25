import {createHash,randomBytes} from "node:crypto";
import {prisma} from "@/lib/prisma/client";
import type {Prisma} from "@prisma/client";
import {z} from "zod";
import {assertCanEditEvent} from "./workspace-service";
export type GuestInput={email:string;displayName?:string;isOptional?:boolean};
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
/** Invitations are stored with the event in the same transaction; no mail is sent here. */
export async function synchronizeGuests(tx:Prisma.TransactionClient,eventId:string,guests:GuestInput[]) {
 const emails=[...new Set(guests.map(g=>g.email.toLowerCase()))];
 await tx.attendee.deleteMany({where:{eventId,email:{notIn:emails}}});
 for(const guest of guests){const email=guest.email.toLowerCase();const existing=await tx.attendee.findUnique({where:{eventId_email:{eventId,email}}});if(existing){await tx.attendee.update({where:{id:existing.id},data:{displayName:guest.displayName,isOptional:guest.isOptional??false}});continue;}
  const token=randomBytes(32).toString("hex");const attendee=await tx.attendee.create({data:{eventId,email,displayName:guest.displayName,isOptional:guest.isOptional??false,inviteTokenHash:digest(token),inviteExpiresAt:new Date(Date.now()+30*86400000)}});
  await tx.deliveryJob.create({data:{dedupeKey:"invite:"+attendee.id,payload:{kind:"invitation",attendeeId:attendee.id,eventId,token}}});
 }
}
export async function renewInvitationLink(userId:string,eventId:string,email:string) {
 await assertCanEditEvent(userId,eventId);
 const token=randomBytes(32).toString("hex");
 const attendee=await prisma.attendee.findUnique({where:{eventId_email:{eventId,email:email.toLowerCase()}}});if(!attendee)throw new Error("NOT_FOUND: guest");
 await prisma.$transaction([prisma.attendee.update({where:{id:attendee.id},data:{inviteTokenHash:digest(token),inviteExpiresAt:new Date(Date.now()+30*86400000)}}),prisma.deliveryJob.deleteMany({where:{dedupeKey:"invite:"+attendee.id,deliveredAt:null}})]);
 return token;
}
export async function getInvitation(token:string) {
 if(!/^[a-f0-9]{64}$/.test(token))throw new Error("NOT_FOUND: invitation");
 const attendee=await prisma.attendee.findUnique({where:{inviteTokenHash:digest(token)},include:{event:{include:{createdBy:true,calendar:true}}}});
 if(!attendee || !attendee.inviteExpiresAt || +attendee.inviteExpiresAt<Date.now() || attendee.event.deletedAt || attendee.event.status==="cancelled")throw new Error("NOT_FOUND: Invitation expired or event cancelled");
 return attendee;
}
export async function respondToInvitation(token:string,raw:unknown) {
 const {responseStatus}=z.object({responseStatus:z.enum(["accepted","tentative","declined"])}).parse(raw);
 const attendee=await getInvitation(token);
 await prisma.$transaction([
  prisma.attendee.update({where:{id:attendee.id},data:{responseStatus}}),
  prisma.notification.upsert({where:{id:"rsvp:"+attendee.id+":"+responseStatus},create:{id:"rsvp:"+attendee.id+":"+responseStatus,userId:attendee.event.createdById,workspaceId:attendee.event.calendar.workspaceId,eventId:attendee.eventId,type:"event_update",title:attendee.email+" responded "+responseStatus,body:attendee.event.title},update:{}}),
 ]);
 return responseStatus;
}
