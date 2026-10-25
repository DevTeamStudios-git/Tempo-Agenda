import type {EventRecord} from "@/features/calendar/types";
import {toInstant} from "@/lib/dates/date-utils";
export function findAvailableSlots(events:EventRecord[],date:string,timeZone:string,startMinutes:number,endMinutes:number,duration:number) {
 if(duration<15 || duration>480 || startMinutes<0 || endMinutes>1440 || endMinutes<=startMinutes)return [];
 const dayStart=Date.parse(toInstant(date,0,timeZone));const dayEnd=Date.parse(toInstant(date,1440,timeZone));
 const busy=events.filter(e=>e.status!=="cancelled"&&e.availability!=="free"&&Date.parse(e.startAt)<dayEnd&&(Date.parse(e.endAt)>dayStart||(e.allDay&&Date.parse(e.endAt)>=dayStart)));
 const result:{startAt:string;endAt:string}[]=[];
 for(let minute=startMinutes;minute+duration<=endMinutes;minute+=15){const start=Date.parse(toInstant(date,minute,timeZone)),end=Date.parse(toInstant(date,minute+duration,timeZone));if(end<=start)continue;if(!busy.some(e=>e.allDay?true:Date.parse(e.startAt)<end&&Date.parse(e.endAt)>start))result.push({startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()});}
 return result;
}
export function timeInsights(events:EventRecord[],start:Date,end:Date) {
 const totals:Record<string,number>={};for(const e of events){if(e.allDay||e.status==="cancelled")continue;const ms=Math.max(0,Math.min(Date.parse(e.endAt),+end)-Math.max(Date.parse(e.startAt),+start));const key=e.eventType??"event";totals[key]=(totals[key]??0)+ms/3600000;}return totals;
}
