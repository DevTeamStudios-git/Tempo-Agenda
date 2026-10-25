"use client";
import {useEffect,useState} from "react";
import type {AiModel,AiProvider} from "@/lib/ai/catalog";
export function useProviderModels(provider:AiProvider,apiKey:string|undefined,enabled:boolean){
 const [revision,setRevision]=useState(0),[state,setState]=useState<{provider:AiProvider;models:AiModel[];loading:boolean;error:string;source:string;defaultModel:string}>({provider,models:[],loading:false,error:"",source:"",defaultModel:""});
 useEffect(()=>{if(!enabled)return;const controller=new AbortController();setState({provider,models:[],loading:true,error:"",source:"",defaultModel:""});const timer=setTimeout(async()=>{try{const r=await fetch("/api/ai/models",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,apiKey,refresh:revision>0}),signal:controller.signal});const b=await r.json();if(!r.ok)throw new Error(b?.error?.message??"Could not load models");if(!controller.signal.aborted)setState({provider,models:b.models,loading:false,error:"",source:b.credentialSource,defaultModel:b.defaultModel});}catch(e){if(!controller.signal.aborted)setState({provider,models:[],loading:false,error:(e as Error).message,source:"",defaultModel:""});}},400);return()=>{clearTimeout(timer);controller.abort();};},[provider,apiKey,enabled,revision]);
 return {...state,refresh:()=>setRevision(n=>n+1)};
}
