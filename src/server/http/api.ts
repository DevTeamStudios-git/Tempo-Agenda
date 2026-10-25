import {headers} from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function requireUser() {
  const authorization=(await headers()).get("authorization");
  if(authorization && !/^Bearer [^\s]{1,8192}$/i.test(authorization))throw new Error("UNAUTHENTICATED: Invalid authorization header");
  const token=authorization?.slice(7);
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.getUser(token);
  if(error || !data.user) throw new Error("UNAUTHENTICATED: Sign in required");
  return data.user;
}
export function apiError(error: unknown) {
  const message=error instanceof Error ? error.message : "Unexpected error";
  const status=error instanceof ZodError || error instanceof SyntaxError || message.startsWith("BAD_REQUEST") ? 400 : message.startsWith("UNAUTHENTICATED") ? 401 : message.startsWith("FORBIDDEN") ? 403 : message.startsWith("NOT_FOUND") ? 404 : message.startsWith("CONFLICT") ? 409 : 500;
  if(status===500) console.error(error);
  return NextResponse.json({error:{message:status===500?"Service unavailable. Please try again.":message}},{status});
}
