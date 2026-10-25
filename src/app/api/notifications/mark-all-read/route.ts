import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {z} from "zod";import {markAllNotificationsRead} from "@/server/services/notification-service";
export async function POST(req:NextRequest){try{const user=await requireUser(),{workspaceId}=z.object({workspaceId:z.string().min(1)}).parse(await req.json());await markAllNotificationsRead(user.id,workspaceId);return NextResponse.json({ok:true});}catch(e){return apiError(e);}}
