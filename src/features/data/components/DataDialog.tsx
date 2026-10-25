"use client";
import {saveFile} from "@/lib/native/bridge";
import {AdvancedSearch} from "@/features/calendar/components/AdvancedSearch";
import {CalendarManager} from "@/features/calendar/components/CalendarManager";
import {useRef,useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import type {CalendarSummary,EventRecord} from "@/features/calendar/types";
import {parseCalendarCsv} from "@/lib/ics/csv";
import {parseIcs,type IcsEvent} from "@/lib/ics/ical";
import {useDialogFocus} from "@/lib/use-dialog-focus";
import {readApiError} from "@/lib/api/error";
import {toInstant,addDays,dayKey} from "@/lib/dates/date-utils";
export function DataDialog({open,onClose,workspaceId,calendars,timeZone,onSelectEvent}:{open:boolean;onClose:()=>void;workspaceId:string;calendars:CalendarSummary[];timeZone:string;onSelectEvent:(event:EventRecord)=>void}) {
 const ref=useRef<HTMLDivElement>(null);useDialogFocus(open,ref,onClose);
 const [tab,setTab]=useState("transfer"),[preview,setPreview]=useState<IcsEvent[]>([]),[notes,setNotes]=useState<string[]>([]),[target,setTarget]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const today=dayKey(new Date().toISOString(),timeZone);
 const [start,setStart]=useState(today),[end,setEnd]=useState(today);
 const client=useQueryClient();
 const trash=useQuery<{events:EventRecord[]}>({queryKey:["trash",workspaceId],enabled:open&&tab==="trash",queryFn:async()=>{const r=await fetch(`/api/events/trash?workspaceId=${workspaceId}`);if(!r.ok)await readApiError(r);return r.json();}});
 async function load(file:File) {
  setError("");setMessage("");
  try{if(file.size>5_000_000)throw new Error("Choose a calendar file under 5 MB");const text=await file.text();const result=file.name.toLowerCase().endsWith(".csv")?parseCalendarCsv(text,timeZone):parseIcs(text,timeZone);setPreview(result.events);setNotes(result.notes);if(!result.events.length)throw new Error("No supported events found");}catch(e){setError((e as Error).message);}
 }
 async function importEvents(){
  setBusy(true);setError("");let imported=0;const failed:IcsEvent[]=[];
  try{for(const e of preview){
   const r=await fetch("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({calendarId:target||calendars[0]?.id,title:e.title,description:e.description??"",location:e.location??"",startAt:e.startAt,endAt:e.endAt,timezone:e.timezone,allDay:e.allDay,visibility:e.visibility??"default",availability:e.availability??"busy",labels:e.categories.filter(l=>!l.startsWith("tempo:")),recurrence:e.rrule?{rrule:e.rrule}:null})});
   if(r.ok)imported++;else{failed.push(e);const b=await r.json().catch(()=>null);setError(b?.error?.message??"Import failed");}
  }setPreview(failed);setMessage(`${imported} imported; ${failed.length} remaining. Successful events have been removed from the preview.`);await client.invalidateQueries({queryKey:["events"]});}catch(e){setError((e as Error).message);setPreview(preview.slice(imported));}finally{setBusy(false);}
 }
 async function restore(id:string){setBusy(true);setError("");try{const r=await fetch(`/api/events/${id}/restore`,{method:"POST"});if(!r.ok)await readApiError(r);await Promise.all([client.invalidateQueries({queryKey:["trash"]}),client.invalidateQueries({queryKey:["events"]})]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function exportEvents(){setBusy(true);setError("");try{const a=toInstant(start,0,timeZone),b=addDays(new Date(toInstant(end,0,timeZone)),1,timeZone).toISOString();const p=new URLSearchParams({workspaceId,start:a,end:b});const r=await fetch(`/api/events/export?${p}`);if(!r.ok)await readApiError(r);saveFile(await r.text(),"tempo-calendar.ics","text/calendar");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!open)return null;
 return <div className="ov"><div ref={ref} className="dlg data-dialog" role="dialog" aria-modal="true" aria-label="Calendar data"><div className="dialog-heading"><h2>Calendar data</h2><button className="icon" aria-label="Close" disabled={busy} onClick={onClose}>×</button></div><div className="seg"><button aria-pressed={tab==="search"} onClick={()=>setTab("search")}>Search</button><button aria-pressed={tab==="calendars"} onClick={()=>setTab("calendars")}>Calendars</button><button aria-pressed={tab==="transfer"} onClick={()=>setTab("transfer")}>Import / export</button><button aria-pressed={tab==="trash"} onClick={()=>setTab("trash")}>Trash</button></div>
 {tab==="search"?<AdvancedSearch workspaceId={workspaceId} calendars={calendars} timeZone={timeZone} onSelect={e=>{onSelectEvent(e);onClose();}}/>:tab==="calendars"?<CalendarManager workspaceId={workspaceId}/>:tab==="transfer"?<><h3>Export calendars</h3><p>Download events and recurring series in a date range.</p><label className="fld">From<input aria-label="Export start date" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="fld">Through<input aria-label="Export end date" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><button className="btn" disabled={busy||!start||!end} onClick={exportEvents}>Download .ics</button><h3>Import events</h3><label className="fld">Calendar<select aria-label="Import calendar" value={target||calendars[0]?.id||""} onChange={e=>setTarget(e.target.value)}>{calendars.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><input aria-label="Choose calendar file" type="file" accept=".ics,.csv,text/calendar,text/csv" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);}}/>{notes.map((n,i)=><p className="option-help" key={i}>{n}</p>)}<div className="data-list">{preview.slice(0,50).map((e,i)=><p key={i}><b>{e.title}</b> · {new Date(e.startAt).toLocaleDateString()} {e.rrule?"↻":""}</p>)}</div>{preview.length>0&&<button className="btn primary" disabled={busy||!calendars.length} onClick={importEvents}>{busy?"Importing…":`Import ${preview.length} events`}</button>}</>:<><p>Restore recently deleted events.</p>{trash.isLoading&&<p>Loading…</p>}{trash.error&&<p role="alert">{trash.error.message}</p>}{trash.data?.events.length===0&&<p>Trash is empty.</p>}<div className="data-list">{trash.data?.events.map(e=><div className="trash-row" key={e.id}><span><b>{e.title}</b><small>{new Date(e.startAt).toLocaleDateString()}</small></span><button className="btn" disabled={busy} onClick={()=>restore(e.id)}>Restore</button></div>)}</div></>}
 {message&&<p role="status">{message}</p>}{error&&<p className="err" role="alert">{error}</p>}</div></div>;
}
