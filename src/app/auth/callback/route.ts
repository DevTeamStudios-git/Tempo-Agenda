import { safeReturnPath } from "../../../../shared/mobile-policy";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") ?? "/";
  const next = safeReturnPath(requested);
  if (code && url.searchParams.get("native") === "1") {
    const target = new URL("tempo://auth/callback");
    target.searchParams.set("code", code);
    const flow = url.searchParams.get("flow");
    if (flow && /^[a-f0-9]{32}$/.test(flow))
      target.searchParams.set("flow", flow);
    return NextResponse.redirect(target, 303);
  }
  if (code) {
    const res = NextResponse.redirect(new URL(next, req.url));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet: any) => {
            for (const { name, value, options } of cookiesToSet)
              res.cookies.set(name, value, options);
          },
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
    return res;
  }
  return NextResponse.redirect(new URL("/", req.url));
}
