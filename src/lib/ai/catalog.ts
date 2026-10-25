export type AiProvider="groq"|"openrouter"|"together";
export interface AiModel {id:string;label:string;vision:boolean}
/** Startup choices only. Authenticated provider discovery supplies the live list. */
export const AI_MODELS:Record<AiProvider,AiModel[]>={
 groq:[{id:"openai/gpt-oss-20b",label:"GPT OSS 20B",vision:false},{id:"openai/gpt-oss-120b",label:"GPT OSS 120B",vision:false},{id:"qwen/qwen3.8-27b",label:"Qwen 3.8 27B",vision:true}],
 openrouter:[],together:[],
};
export const AI_DEFAULT_MODEL:Record<AiProvider,string>={groq:"openai/gpt-oss-20b",openrouter:"",together:""};
export const AI_KEY_PREFIXES:Record<AiProvider,string>={groq:"gsk_",openrouter:"sk-or-",together:"tgp_"};
export function personalApiKey(provider:AiProvider,value:string,prefix?:string):string|undefined {
 const key=value.trim();if(!key)return undefined;
 // Preserve full pasted keys. Older settings stored only a suffix.
 const expected=prefix??AI_KEY_PREFIXES[provider];
 if(provider==="groq"&&!key.startsWith("gsk_"))return "gsk_"+key;
 if(provider==="openrouter"&&!key.startsWith("sk-or-"))return "sk-or-"+key;
 return expected&&key.startsWith(expected)?key:key;
}
export function modelIsVision(model:string){return AI_MODELS.groq.some(m=>m.id===model&&m.vision)||/vision|llava|gpt-4o|gemini|llama-4|qwen3\.8/i.test(model);}
