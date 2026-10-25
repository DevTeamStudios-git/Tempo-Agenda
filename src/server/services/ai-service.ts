import {createHash} from "node:crypto";
import type {AiProvider,AiModel} from "@/lib/ai/catalog";
import {AI_DEFAULT_MODEL,modelIsVision} from "@/lib/ai/catalog";
export const PROVIDERS:Record<AiProvider,{base:string;env:string}>={groq:{base:"https://api.groq.com/openai/v1",env:"GROQ_API_KEY"},openrouter:{base:"https://openrouter.ai/api/v1",env:"OPENROUTER_API_KEY"},together:{base:"https://api.together.xyz/v1",env:"TOGETHER_API_KEY"}};
export class AiError extends Error {constructor(message:string,public status:number=502,public code="PROVIDER_ERROR"){super(message);}}
const cache=new Map<string,{at:number;models:AiModel[]}>();
export function providerKey(provider:AiProvider,personal?:string){const key=personal?.trim()||process.env[PROVIDERS[provider].env]?.trim();if(!key)throw new AiError(`Configure ${PROVIDERS[provider].env} on the server or enter your complete ${provider} API key in Settings → AI.`,503,"AI_NOT_CONFIGURED");return key;}
function cacheKey(provider:AiProvider,key:string){return provider+":"+createHash("sha256").update(key).digest("hex");}
function providerError(body:unknown,status:number,key:string){const b=body as {error?:{message?:string;code?:string};message?:string};const message=String(b?.error?.message??b?.message??`Provider request failed (${status})`).split(key).join("[redacted]").slice(0,600);return new AiError(message,status===429?429:status===401||status===403?400:502,b?.error?.code??"PROVIDER_ERROR");}
export async function availableModels(provider:AiProvider,key:string,refresh=false):Promise<AiModel[]> {
 const id=cacheKey(provider,key),saved=cache.get(id);if(!refresh&&saved&&Date.now()-saved.at<300000)return saved.models;
 let r:Response;try{r=await fetch(PROVIDERS[provider].base+"/models",{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(15000),cache:"no-store"});}catch{throw new AiError("Could not reach the AI provider. Try again.",503,"PROVIDER_UNAVAILABLE");}
 const body=await r.json().catch(()=>null);if(!r.ok)throw providerError(body,r.status,key);
 const rows:Array<Record<string,unknown>>=Array.isArray(body)?body:Array.isArray(body?.data)?body.data:[];
 const models=rows.filter(m=>typeof m.id==="string"&&m.active!==false).filter(m=>{
  const name=String(m.id);if(/whisper|orpheus|prompt-guard|safeguard|tts|transcrib|embed|moderation|rerank/i.test(name))return false;
  if(provider==="together"&&m.type&&m.type!=="chat")return false;
  const arch=m.architecture as {output_modalities?:string[]}|undefined;
  return !arch?.output_modalities||arch.output_modalities.includes("text");
 }).map(m=>{const arch=m.architecture as {input_modalities?:string[]}|undefined;return {id:String(m.id),label:String(m.name??m.display_name??m.id),vision:arch?.input_modalities?.includes("image")??modelIsVision(String(m.id))};}).sort((a,b)=>a.id.localeCompare(b.id));
 if(!models.length)throw new AiError("This provider account has no available chat models.",503,"NO_CHAT_MODELS");
 if(cache.size>100)cache.clear();cache.set(id,{at:Date.now(),models});return models;
}
export function chooseModel(provider:AiProvider,models:AiModel[],requested:string|undefined,vision=false){const usable=models.filter(m=>!vision||m.vision);if(!usable.length)throw new AiError("No image-capable model is available for this account. Remove the image or select another provider.",400,"VISION_UNAVAILABLE");return usable.find(m=>m.id===requested)??usable.find(m=>m.id===AI_DEFAULT_MODEL[provider])??usable[0]!;}
export async function chatCompletion(input:{provider:AiProvider;model?:string;apiKey?:string;message:string;images?:string[];history?:Array<{role:"user"|"assistant";content:string}>;system?:string;tools?:unknown[]}){
 const {provider}=input,key=providerKey(provider,input.apiKey);let models=await availableModels(provider,key);let selected=chooseModel(provider,models,input.model,!!input.images?.length);
 const content=input.images?.length?[{type:"text",text:input.message||"Describe this image."},...input.images.map(url=>({type:"image_url",image_url:{url}}))]:input.message;
 const messages=[{role:"system",content:input.system??"You are Tempo's scheduling assistant. Help users plan their time and draft calendar event details. You do not currently have calendar action tools. Never claim to have created, read, edited, or deleted calendar data. Be concise and respond in the user's language."},...(input.history??[]).slice(-12),{role:"user",content}];
 for(let attempt=0;attempt<2;attempt++){
  let r:Response;try{r=await fetch(PROVIDERS[provider].base+"/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:selected.id,messages,...(input.tools?.length?{tools:input.tools,tool_choice:"auto"}:{}),...(provider==="groq"?{max_completion_tokens:2048}:{max_tokens:1024}),...(selected.id.includes("gpt-oss")?{reasoning_effort:"low"}:{})}),signal:AbortSignal.timeout(45000)});}catch{throw new AiError("The AI provider timed out or is unreachable. Try again.",503,"PROVIDER_UNAVAILABLE");}
  const body=await r.json().catch(()=>null);
  if(!r.ok){const error=providerError(body,r.status,key);if(attempt===0&&/model_not_found|model_decommissioned|does not exist|decommissioned/i.test(error.code+" "+error.message)){models=(await availableModels(provider,key,true)).filter(m=>m.id!==selected.id);selected=chooseModel(provider,models,undefined,!!input.images?.length);continue;}throw error;}
  const message=body?.choices?.[0]?.message;
  const toolCalls:Array<{id:string;function:{name:string;arguments:string}}>=Array.isArray(message?.tool_calls)?message.tool_calls:[];
  const reply=message?.content;
  if(toolCalls.length)return {reply:typeof reply==="string"?reply:"Review the proposed changes before applying them.",toolCalls,model:selected.id,modelChanged:!!input.model&&input.model!==selected.id};
  if(typeof reply!=="string"||!reply.trim())throw new AiError("The provider returned no answer. Please retry.",502,"EMPTY_RESPONSE");
  return {reply,model:selected.id,modelChanged:!!input.model&&input.model!==selected.id};
 }
 throw new AiError("No usable model was available.");
}
