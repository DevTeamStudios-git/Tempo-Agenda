import {describe,it,expect,vi,afterEach} from "vitest";
import {chooseModel,chatCompletion,providerKey,AiError} from "@/server/services/ai-service";
import {personalApiKey} from "@/lib/ai/catalog";
const models=[{id:"openai/gpt-oss-20b",label:"20B",vision:false},{id:"qwen/qwen3.8-27b",label:"Qwen",vision:true}];
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("AI provider reliability",()=>{
 it("replaces a retired model with an available account model",()=>expect(chooseModel("groq",models,"llama-3.3-70b-versatile").id).toBe("openai/gpt-oss-20b"));
 it("selects an available vision model for images",()=>expect(chooseModel("groq",models,"openai/gpt-oss-20b",true).id).toBe("qwen/qwen3.8-27b"));
 it("rejects unavailable vision instead of sending to a text model",()=>expect(()=>chooseModel("groq",models.slice(0,1),undefined,true)).toThrow(/image-capable/));
 it("normalizes legacy key suffixes without doubling full prefixes",()=>{expect(personalApiKey("groq","gsk_example")).toBe("gsk_example");expect(personalApiKey("groq","example")).toBe("gsk_example");expect(personalApiKey("groq","")).toBeUndefined();});
 it("accepts server credentials when no browser key is provided",()=>{vi.stubEnv("GROQ_API_KEY","server-test-key");expect(providerKey("groq")).toBe("server-test-key");});
 it("rejects missing credentials clearly",()=>{vi.stubEnv("GROQ_API_KEY","");expect(()=>providerKey("groq")).toThrow(/Configure GROQ_API_KEY/);});
 it("uses a live discovered model and returns actual completion content",async()=>{const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:models.map(m=>({id:m.id,active:true}))})).mockResolvedValueOnce(Response.json({choices:[{message:{content:"Real response"}}]}));vi.stubGlobal("fetch",fetcher);const r=await chatCompletion({provider:"groq",apiKey:"test-success",model:"gemma2-9b-it",message:"Hello"});expect(r.reply).toBe("Real response");expect(r.model).toBe("openai/gpt-oss-20b");expect(JSON.parse(fetcher.mock.calls[1]![1].body).model).toBe("openai/gpt-oss-20b");});
 it("surfaces provider failures without fabricating mock replies",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(Response.json({data:[{id:"openai/gpt-oss-20b"}]})).mockResolvedValueOnce(Response.json({error:{message:"Rate limited",code:"rate_limit_exceeded"}},{status:429})));await expect(chatCompletion({provider:"groq",apiKey:"test-rate-limit",message:"Hello"})).rejects.toMatchObject({status:429,message:"Rate limited"});});
 it("refreshes model availability once when an advertised model is decommissioned",async()=>{const f=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:"old-chat"},{id:"openai/gpt-oss-20b"}]})).mockResolvedValueOnce(Response.json({error:{code:"model_decommissioned",message:"Model decommissioned"}},{status:400})).mockResolvedValueOnce(Response.json({data:[{id:"openai/gpt-oss-20b"}]})).mockResolvedValueOnce(Response.json({choices:[{message:{content:"Recovered"}}]}));vi.stubGlobal("fetch",f);const r=await chatCompletion({provider:"groq",apiKey:"test-refresh",model:"old-chat",message:"Hi"});expect(r.reply).toBe("Recovered");expect(r.modelChanged).toBe(true);expect(f).toHaveBeenCalledTimes(4);});
});
