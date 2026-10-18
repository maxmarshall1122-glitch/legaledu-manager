import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];

/**
 * Next.js 16 proxy (formerly middleware): refreshes the Supabase session cookie
 * and sends signed-out visitors to /login early. This is only a convenience —
 * every page, server action and route handler re-checks the session and
 * authorizes on the server.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  let response = NextResponse.next({ request });

  const env = supabaseEnv();
  // Misconfigured Supabase settings: let the request through so the app can show its setup page.
  if (env.problem || pathname === "/api/health") return response;
  let signedIn = false;
  if (env.configured) {
    try {
      const supabase = createServerClient(env.url, env.anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list) => {
            for (const { name, value } of list) request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of list) response.cookies.set(name, value, options);
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch (e) {
      // Never crash every request because the auth service is unreachable; pages re-check the session.
      console.error("[proxy] Supabase session refresh failed", e instanceof Error ? e.message : e);
    }
  } else {
    signedIn = request.cookies.has("le_demo_session");
  }

  if (!signedIn && !isPublic && !pathname.startsWith("/api/")) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
