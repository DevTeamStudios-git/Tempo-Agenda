import { NextRequest,NextResponse } from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {exportCalendarEvents} from "@/server/services/event-service";
import {serializeIcs} from "@/lib/ics/ical";
export async function GET(req:NextRequest) {
 try {
  const user=await requireUser();const p=req.nextUrl.searchParams;
  const workspace=p.get("workspaceId"),start=new Date(p.get("start") ?? ""),end=new Date(p.get("end") ?? "");
  if(!workspace || !Number.isFinite(+start) || !Number.isFinite(+end) || end<=start || +end-+start>367*86400000) throw new Error("BAD_REQUEST: Choose a valid range up to one year");
  const ids=p.getAll("calendarId");
  const events=await exportCalendarEvents(user.id,workspace,ids.length?ids:undefined,start,end);
  return new NextResponse(serializeIcs(events,[],"Tempo"),{headers:{"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'attachment; filename="tempo-calendar.ics"',"Cache-Control":"no-store"}});
 } catch(e){return apiError(e);}
}
