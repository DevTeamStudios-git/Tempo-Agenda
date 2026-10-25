/**
 * Server-side Supabase client — reads the caller's session from cookies so
 * RLS policies apply exactly as they would for a direct client request.
 * Use this (not the service-role client) for anything acting "as the user".
 *
 * Architectural note (Notebook v2 §3-4): this authenticates the HTTP request,
 * but subsequent Prisma calls DO NOT inherit Supabase RLS. Prisma uses
 * DATABASE_URL (pooled) which bypasses RLS — service authorization is primary.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supabaseAnonKey(): string {
  // Support both legacy ANON_KEY and current publishable-key naming (Notebook v2 §12).
  return (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "") as string;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!supabaseAnonKey();
}

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: any) => {
          // Next.js 15: cookies().set() throws in Server Components (Page).
          // Supabase SSR docs: wrap in try/catch and let middleware handle refresh.
          // See https://nextjs.org/docs/app/api-reference/functions/cookies#options
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {}
        },
      },
    }
  );
}
