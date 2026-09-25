import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/auth", "/live", "/remix"];

/**
 * Refresh the Supabase session once per request, before any page, server action or API route runs.
 * Refresh tokens are single-use, so refreshing here (not in parallel handlers) avoids races that log people out.
 */
export async function proxy(request: NextRequest) {
  // Not configured yet (e.g. first local run): let public pages render instead of crashing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Cache-Control etc. so a CDN never caches a response carrying auth cookies.
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // getClaims refreshes an expiring session and verifies the JWT (locally with asymmetric keys — fast for autocomplete).
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;
  if (error && error.name !== "AuthSessionMissingError") console.error("auth refresh failed:", error.code ?? error.name, error.message);

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) return response; // API routes answer 401 themselves
  const isPublic = PUBLIC.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav)$).*)"],
};
