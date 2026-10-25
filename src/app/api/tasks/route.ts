import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {listTasks,createTask} from "@/server/services/task-service";
export async function GET(req:NextRequest){try{const user=await requireUser(),workspace=req.nextUrl.searchParams.get("workspaceId");if(!workspace)throw new Error("BAD_REQUEST: Workspace required");return NextResponse.json({tasks:await listTasks(user.id,workspace)},{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const user=await requireUser(),body=await req.json();if(!body.workspaceId)throw new Error("BAD_REQUEST: Workspace required");return NextResponse.json({task:await createTask(user.id,body.workspaceId,body)},{status:201});}catch(e){return apiError(e);}}
