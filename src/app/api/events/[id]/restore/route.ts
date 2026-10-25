import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {restoreEvent} from "@/server/services/event-service";
export async function POST(_req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;return NextResponse.json({event:await restoreEvent(user.id,id)});}catch(e){return apiError(e);}}
