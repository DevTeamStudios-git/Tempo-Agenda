import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {updateTask} from "@/server/services/task-service";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;return NextResponse.json({task:await updateTask(user.id,id,await req.json())});}catch(e){return apiError(e);}}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;await updateTask(user.id,id,null,true);return new NextResponse(null,{status:204});}catch(e){return apiError(e);}}
