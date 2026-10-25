"use client";
import { createBrowserClient } from "@supabase/ssr";

function anonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "") as string;
}

export function createSupabaseBrowserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !anonKey()) {
    // Return mock that surfaces config error on use, but doesn't crash prerender
    return {
      auth: {
        signInWithPassword: async () => ({ data: null, error: { message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and the public Supabase key." } }),
        signUp: async () => ({ data: null, error: { message: "Supabase not configured." } }),
        signInWithOAuth: async () => ({ data: null, error: { message: "Supabase not configured." } }),
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        exchangeCodeForSession: async () => ({ data: null, error: null }),
      },
    } as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey()
  );
}
