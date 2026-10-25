import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requireUser,apiError} from "@/server/http/api";
import {availableModels,providerKey,chooseModel,AiError} from "@/server/services/ai-service";
const schema=z.object({provider:z.enum(["groq","openrouter","together"]),apiKey:z.string().max(512).optional(),refresh:z.boolean().optional()});
export async function POST(req:NextRequest){try{await requireUser();const {provider,apiKey,refresh}=schema.parse(await req.json());const models=await availableModels(provider,providerKey(provider,apiKey),refresh);return NextResponse.json({models,defaultModel:chooseModel(provider,models,undefined).id,credentialSource:apiKey?"personal":"server"},{headers:{"Cache-Control":"no-store"}});}catch(e){if(e instanceof AiError)return NextResponse.json({error:{message:e.message,code:e.code}},{status:e.status});return apiError(e);}}
