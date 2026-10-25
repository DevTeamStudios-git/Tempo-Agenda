import {fromZonedTime} from "date-fns-tz";
import type {IcsEvent} from "./ical";
/** Google Calendar's CSV columns, with RFC-4180 quoted fields and embedded newlines. */
export function parseCalendarCsv(text:string,timeZone:string):{events:IcsEvent[];notes:string[]} {
 if(text.length>5_000_000)throw new Error("Calendar file exceeds 5 MB");
 const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
 text=text.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){const c=text[i]!;if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(field);field="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field="";}else field+=c;}
 if(quoted)throw new Error("Unterminated quoted CSV field");row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 const headers=rows.shift()?.map(h=>h.trim().toLowerCase())??[];
 if(!headers.includes("subject")||!headers.includes("start date"))throw new Error("CSV must include Subject and Start Date columns");
 const events:IcsEvent[]=[],notes:string[]=[];
 const civil=(value:string)=>{const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value),us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);if(iso)return value;if(us)return `${us[3]}-${us[1]!.padStart(2,"0")}-${us[2]!.padStart(2,"0")}`;throw new Error("Invalid date");};
 const clock=(value:string)=>{const m=/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i.exec(value);if(!m)throw new Error("Invalid time");let h=+m[1]!,min=+m[2]!;if(m[3]){if(h<1||h>12)throw new Error("Invalid clock hour");h=h%12+(m[3].toUpperCase()==="PM"?12:0);}if(h>23||min>59)throw new Error("Invalid time");return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:00`;};
 for(const [index,r]of rows.entries()){try{const get=(key:string)=>r[headers.indexOf(key)]?.trim()??"";const title=get("subject");if(!title)throw new Error("Missing subject");const date=civil(get("start date")),endDate=civil(get("end date")||get("start date"));const allDay=get("all day event").toLowerCase()==="true"||!get("start time");const startAt=fromZonedTime(date+"T"+(allDay?"00:00:00":clock(get("start time"))),timeZone).toISOString();const endAt=allDay?fromZonedTime(endDate+"T00:00:00",timeZone).toISOString():get("end time")?fromZonedTime(endDate+"T"+clock(get("end time")),timeZone).toISOString():new Date(Date.parse(startAt)+3600000).toISOString();if(Date.parse(endAt)<Date.parse(startAt)||(!allDay&&endAt===startAt))throw new Error("End precedes start");events.push({title,description:get("description"),location:get("location"),startAt,endAt,allDay,timezone:timeZone,categories:[],visibility:get("private").toLowerCase()==="true"?"private":"default"});}catch(e){notes.push(`Row ${index+2} skipped: ${(e as Error).message}`);}}
 return {events,notes};
}
