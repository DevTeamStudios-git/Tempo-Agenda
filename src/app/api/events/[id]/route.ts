import {NextRequest,NextResponse} from "next/server";
import {requireUser,apiError} from "@/server/http/api";
import {deleteEvent,updateEvent,mutateOccurrence} from "@/server/services/event-service";
function scope(req:NextRequest){const s=req.nextUrl.searchParams.get("scope")??"this";if(s!=="this"&&s!=="following"&&s!=="series")throw new Error("BAD_REQUEST: Invalid edit scope");return s;}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params,body=await req.json();return NextResponse.json({event:id.includes("~")?await mutateOccurrence(user.id,id,body,scope(req)):await updateEvent(user.id,id,body)});}catch(e){return apiError(e);}}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;if(id.includes("~"))await mutateOccurrence(user.id,id,{},scope(req),true);else await deleteEvent(user.id,id);return new NextResponse(null,{status:204});}catch(e){return apiError(e);}}
