import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {listTrash} from "@/server/services/event-service";
export async function GET(req:NextRequest){try{const user=await requireUser(),workspace=req.nextUrl.searchParams.get("workspaceId");if(!workspace)throw new Error("BAD_REQUEST: Workspace required");return NextResponse.json({events:await listTrash(user.id,workspace)},{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
