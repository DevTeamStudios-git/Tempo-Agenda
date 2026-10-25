import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {deliverReminders} from "@/server/services/reminder-service";
import {apiError} from "@/server/http/api";
export async function GET(req:NextRequest){const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)return NextResponse.json({error:{message:"Reminder scheduler is not configured"}},{status:503});const expected=Buffer.from("Bearer "+secret),provided=Buffer.from(req.headers.get("authorization")??"");if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return NextResponse.json({error:{message:"Unauthorized"}},{status:401});try{return NextResponse.json(await deliverReminders(),{headers:{"Cache-Control":"no-store"}});}catch(e){return apiError(e);}}
