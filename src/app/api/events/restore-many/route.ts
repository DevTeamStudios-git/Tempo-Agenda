import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {z} from "zod";import {restoreAllDayEvents} from "@/server/services/event-service";
export async function POST(req:NextRequest){try{const user=await requireUser(),b=z.object({workspaceId:z.string().min(1),ids:z.array(z.string()).max(1000)}).parse(await req.json());return NextResponse.json(await restoreAllDayEvents(user.id,b.workspaceId,b.ids));}catch(e){return apiError(e);}}
