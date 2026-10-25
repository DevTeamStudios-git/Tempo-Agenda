import {createHash} from "node:crypto";
import {prisma} from "@/lib/prisma/client";
import {expandEvents} from "@/lib/recurrence/engine";
import type {EventRecord} from "@/features/calendar/types";
export function reminderId(userId:string,eventId:string,startAt:string,minutes:number){return "reminder-"+createHash("sha256").update([userId,eventId,new Date(startAt).toISOString(),minutes].join("|")).digest("hex");}
/** Call every minute from an authenticated scheduler; retries are idempotent. */
export async function deliverReminders(now=new Date(),workspaceId?:string){
 let cursor:string|undefined,created=0,scanned=0;
 do{
  const reminders=await prisma.reminder.findMany({where:{channel:"in_app",event:{deletedAt:null,status:{not:"cancelled"},calendar:{isArchived:false,deletedAt:null,...(workspaceId?{workspaceId}:{})}}},include:{event:{include:{recurrenceRule:true,calendar:true}}},orderBy:{id:"asc"},take:250,...(cursor?{cursor:{id:cursor},skip:1}:{})});
  if(!reminders.length)break;
  for(const r of reminders){scanned++;const e=r.event;const m=await prisma.membership.findUnique({where:{workspaceId_userId:{workspaceId:e.calendar.workspaceId,userId:r.userId}}});if(!m)continue;
   const source:EventRecord={id:e.id,calendarId:e.calendarId,title:e.title,description:e.description??"",location:e.location??"",startAt:e.startAt.toISOString(),endAt:e.endAt.toISOString(),timezone:e.timezone,allDay:e.allDay,status:e.status,labels:[],recurrence:e.recurrenceRule?{rrule:e.recurrenceRule.rrule}:null};
   const from=new Date(+now-10*60000+r.minutesBefore*60000),to=new Date(+now+r.minutesBefore*60000+1);
   for(const occurrence of expandEvents([source],from,to)){const trigger=Date.parse(occurrence.startAt)-r.minutesBefore*60000;if(trigger<+now-10*60000||trigger>+now)continue;
    const id=reminderId(r.userId,e.id,occurrence.startAt,r.minutesBefore),title=e.visibility==="private"&&m.role==="viewer"&&e.createdById!==r.userId?"Busy":e.title;
    const result=await prisma.notification.createMany({data:[{id,userId:r.userId,workspaceId:e.calendar.workspaceId,eventId:e.id,type:"event_reminder",title:"Upcoming: "+title,body:`Starts in ${r.minutesBefore} minutes`}],skipDuplicates:true});created+=result.count;
   }
  }
  cursor=reminders.at(-1)!.id;if(reminders.length<250)break;
 }while(scanned<5000);
 return {created,scanned,truncated:scanned>=5000};
}
