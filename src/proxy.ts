import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Keeps the Supabase session cookie fresh and sends signed-out visitors to /login.
 * In demo mode (Supabase not configured) it does nothing.
 */
export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() verifies the JWT signature, unlike reading the cookie's user object directly.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const onLogin = request.nextUrl.pathname.startsWith("/login");
  // API routes do their own authentication (session cookie or CRON_SECRET) and must answer 401/JSON,
  // not redirect to an HTML page.
  if (request.nextUrl.pathname.startsWith("/api/")) return response;

  if (!signedIn && !onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (signedIn && onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
