import {NextRequest,NextResponse} from "next/server";
import {apiError} from "@/server/http/api";
import {respondToInvitation} from "@/server/services/invitation-service";
export async function POST(req:NextRequest,{params}:{params:Promise<{token:string}>}){try{const {token}=await params;return NextResponse.json({responseStatus:await respondToInvitation(token,await req.json())},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});}catch(e){return apiError(e);}}
