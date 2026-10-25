"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {formatInTimeZone} from "date-fns-tz";
import {addMonths,addDays,startOfWeek,toInstant} from "@/lib/dates/date-utils";
import {useDialogFocus} from "@/lib/use-dialog-focus";
export function DatePicker({anchor,timeZone,weekStart="monday",onSelect,onClose}:{anchor:Date;timeZone:string;weekStart?:"monday"|"sunday";onSelect:(iso:string)=>void;onClose:()=>void}){
 const [month,setMonth]=useState(anchor);const ref=useRef<HTMLDivElement>(null);useDialogFocus(true,ref,onClose);
 useEffect(()=>setMonth(anchor),[anchor]);
 const grid=useMemo(()=>{const first=new Date(toInstant(formatInTimeZone(month,timeZone,"yyyy-MM")+"-01",0,timeZone));const start=startOfWeek(first,timeZone,weekStart);return Array.from({length:42},(_,i)=>addDays(start,i,timeZone));},[month,timeZone,weekStart]);
 const monthLabel=formatInTimeZone(month,timeZone,"MMMM yyyy"),today=formatInTimeZone(new Date(),timeZone,"yyyy-MM-dd"),selected=formatInTimeZone(anchor,timeZone,"yyyy-MM-dd");
 const weekdays=weekStart==="sunday"?["Su","Mo","Tu","We","Th","Fr","Sa"]:["Mo","Tu","We","Th","Fr","Sa","Su"];
 return <div className="ov" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className="dlg" style={{maxWidth:340}} role="dialog" aria-modal="true" aria-label="Pick a date"><div className="dialog-heading"><button className="icon" aria-label="Previous month" onClick={()=>setMonth(d=>addMonths(d,-1,timeZone))}>‹</button><b>{monthLabel}</b><button className="icon" aria-label="Next month" onClick={()=>setMonth(d=>addMonths(d,1,timeZone))}>›</button><button className="icon" aria-label="Close date picker" onClick={onClose}>×</button></div><div className="mgrid">{weekdays.map(d=><div key={d} className="wd">{d}</div>)}{grid.map(d=>{const k=formatInTimeZone(d,timeZone,"yyyy-MM-dd"),out=formatInTimeZone(d,timeZone,"MM")!==formatInTimeZone(month,timeZone,"MM");return <button key={k} aria-label={formatInTimeZone(d,timeZone,"EEEE, MMMM d, yyyy")} className={`md${out?" out":""}${k===today?" today":""}${k===selected?" sel":""}`} onClick={()=>{onSelect(k);onClose();}}>{formatInTimeZone(d,timeZone,"d")}</button>;})}</div><button className="btn ghost" onClick={()=>{onSelect(today);onClose();}}>Today</button></div></div>;
}
