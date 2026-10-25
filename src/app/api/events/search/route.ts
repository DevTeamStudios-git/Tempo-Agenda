import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {searchEventsGlobal} from "@/server/services/event-service";
export async function GET(req:NextRequest){try{const user=await requireUser(),p=req.nextUrl.searchParams,workspace=p.get("workspaceId"),q=(p.get("q")??"").trim();if(!workspace||q.length>300)throw new Error("BAD_REQUEST: Invalid workspace or query");if(!q||p.has("_emptyCalendars"))return NextResponse.json({events:[]});const ids=p.getAll("calendarId");return NextResponse.json({events:await searchEventsGlobal(user.id,workspace,q,ids.length?ids:undefined,Math.max(1,Math.min(50,Number(p.get("limit"))||20)))},{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
