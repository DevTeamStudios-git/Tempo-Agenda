import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {z} from "zod";import {listNotifications,createNotification} from "@/server/services/notification-service";
export async function GET(req:NextRequest){try{const user=await requireUser(),workspace=req.nextUrl.searchParams.get("workspaceId");if(!workspace)throw new Error("BAD_REQUEST: Workspace required");return NextResponse.json(await listNotifications(user.id,workspace));}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{const user=await requireUser(),{workspaceId,...body}=z.object({workspaceId:z.string().min(1),type:z.string(),title:z.string(),body:z.string().optional(),eventId:z.string().optional(),reminderAt:z.string().optional(),minutesBefore:z.number().optional()}).parse(await req.json());return NextResponse.json(await createNotification(user.id,workspaceId,body));}catch(e){return apiError(e);}}
