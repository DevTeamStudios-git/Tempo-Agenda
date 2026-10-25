import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requireUser,apiError} from "@/server/http/api";
import {renewInvitationLink} from "@/server/services/invitation-service";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),{id}=await params;const {email}=z.object({email:z.string().email()}).parse(await req.json());return NextResponse.json({token:await renewInvitationLink(user.id,id.split("~")[0]!,email)},{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
