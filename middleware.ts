/**
 * Supabase SSR middleware — refreshes expired Auth tokens and propagates
 * refreshed cookies (Notebook v2 §11). Required for Next.js 15 cookie sessions.
 * See: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function anonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export async function middleware(request: NextRequest) {
  if(request.headers.has("authorization"))return NextResponse.next({request:{headers:request.headers}});
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !anonKey()) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey(),
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet: any) => {
            for (const { name, value, options } of cookiesToSet) {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    // Trigger token refresh if needed; this also populates refreshed cookies on `response`.
    // Do not treat getSession as auth — callers still use supabase.auth.getUser() for verified identity.
    await supabase.auth.getUser();
  } catch {
    // Never crash the request because Supabase is misconfigured; treat as unauthenticated.
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
