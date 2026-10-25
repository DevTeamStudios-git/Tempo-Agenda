import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {z} from "zod";import {resetAllDayEvents} from "@/server/services/event-service";
export async function POST(req:NextRequest){try{const user=await requireUser(),b=z.object({workspaceId:z.string().min(1),calendarIds:z.array(z.string()).optional()}).parse(await req.json());return NextResponse.json(await resetAllDayEvents(user.id,b.workspaceId,b.calendarIds));}catch(e){return apiError(e);}}
