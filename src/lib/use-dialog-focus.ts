"use client";
import { useEffect, useRef, type RefObject } from "react";
export function useDialogFocus(open:boolean,ref:RefObject<HTMLElement | null>,onClose:()=>void) {
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    if(!open) return;
    const previous=document.activeElement as HTMLElement | null;
    const dialog=ref.current;
    if(!dialog) return;
    const nodes=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(e=>e.getClientRects().length);
    nodes()[0]?.focus();
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="Escape") {e.preventDefault();e.stopPropagation();closeRef.current();}
      if(e.key!=="Tab") return;
      const list=nodes(),first=list[0],last=list.at(-1);
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
    };
    dialog.addEventListener("keydown",handler);
    return ()=>{dialog.removeEventListener("keydown",handler);previous?.focus();};
  },[open,ref]);
}
