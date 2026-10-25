import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {z} from "zod";import {updateCalendar,deleteCalendar,restoreCalendar} from "@/server/services/calendar-service";
const input=z.object({name:z.string().trim().min(1).max(100).optional(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),isArchived:z.boolean().optional()});
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;return NextResponse.json({calendar:await updateCalendar(user.id,id,input.parse(await req.json()))});}catch(e){return apiError(e);}}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;await deleteCalendar(user.id,id);return new NextResponse(null,{status:204});}catch(e){return apiError(e);}}
export async function POST(_req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;return NextResponse.json({calendar:await restoreCalendar(user.id,id)});}catch(e){return apiError(e);}}
