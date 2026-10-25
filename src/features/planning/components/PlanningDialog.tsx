"use client";
import {useRef,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {formatInTimeZone} from "date-fns-tz";
import {useDialogFocus} from "@/lib/use-dialog-focus";
import {toInstant,addDays} from "@/lib/dates/date-utils";
import {useSettings} from "@/lib/settings";
import type {CalendarSummary,EventRecord} from "@/features/calendar/types";
import {findAvailableSlots,timeInsights} from "../lib/planning";
import {readApiError} from "@/lib/api/error";
export function PlanningDialog({open,onClose,workspaceId,calendars,timeZone,onCreate}:{open:boolean;onClose:()=>void;workspaceId:string;calendars:CalendarSummary[];timeZone:string;onCreate:(startAt:string,endAt:string)=>void}){
 const ref=useRef<HTMLDivElement>(null);useDialogFocus(open,ref,onClose);const {settings,update}=useSettings();
 const [date,setDate]=useState(formatInTimeZone(new Date(),timeZone,"yyyy-MM-dd")),[duration,setDuration]=useState(30),[calendarIds,setCalendarIds]=useState<string[]|null>(null);
 const start=new Date(toInstant(date,0,timeZone)),end=addDays(start,7,timeZone);
 const query=useQuery<EventRecord[]>({queryKey:["planning",workspaceId,date,calendarIds],enabled:open,queryFn:async()=>{const p=new URLSearchParams({workspaceId,rangeStart:start.toISOString(),rangeEnd:end.toISOString()});(calendarIds??calendars.map(c=>c.id)).forEach(id=>p.append("calendarId",id));if(calendarIds?.length===0)p.set("_emptyCalendars","1");const r=await fetch(`/api/events?${p}`);if(!r.ok)await readApiError(r);return(await r.json()).events;}});
 const slots=findAvailableSlots(query.data??[],date,timeZone,settings.workingStart,settings.workingEnd,duration),insights=timeInsights(query.data??[],start,end);
 const format=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
 const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 if(!open)return null;
 return <div className="ov"><div ref={ref} className="dlg data-dialog" role="dialog" aria-modal="true" aria-label="Availability and insights"><div className="dialog-heading"><h2>Plan your time</h2><button className="icon" aria-label="Close planning" onClick={onClose}>×</button></div><p>Find available time across the calendars you can access. Times are shown in {timeZone}.</p><label className="fld">Date<input aria-label="Planning date" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label><div className="fld"><label>Work starts<input aria-label="Work starts" type="time" value={format(settings.workingStart)} onChange={e=>update({workingStart:minutes(e.target.value)})}/></label><label>Work ends<input aria-label="Work ends" type="time" value={format(settings.workingEnd)} onChange={e=>update({workingEnd:minutes(e.target.value)})}/></label></div><label className="fld">Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[15,30,45,60,90,120].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label><fieldset><legend>Check calendars</legend>{calendars.map(c=><label className="calrow" key={c.id}><input type="checkbox" checked={(calendarIds??calendars.map(x=>x.id)).includes(c.id)} onChange={e=>setCalendarIds(ids=>e.target.checked?[...(ids??calendars.map(x=>x.id)),c.id]:(ids??calendars.map(x=>x.id)).filter(id=>id!==c.id))}/>{c.name}</label>)}</fieldset>{query.error&&<p role="alert">{query.error.message}</p>}{query.isFetching?<p>Checking availability…</p>:<><h3>Available times</h3><div className="slot-list">{!slots.length&&<p>No available times in this work window.</p>}{slots.map(slot=><button className="btn" key={slot.startAt} onClick={()=>{onCreate(slot.startAt,slot.endAt);onClose();}}>{formatInTimeZone(slot.startAt,timeZone,settings.timeFormat==="24h"?"HH:mm":"h:mm a")}</button>)}</div></>}<h3>Scheduled time · next 7 days</h3><p className="option-help">Totals count event duration; overlapping meetings are counted separately.</p>{Object.entries(insights).map(([type,hours])=><p key={type}>{type}: <b>{hours.toFixed(1)} hours</b></p>)}</div></div>;
}
