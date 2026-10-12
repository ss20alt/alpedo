import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-origin browser requests that could use the user's session cookie. */
export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/") || SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const originHeader = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol && /^[a-z]+$/i.test(forwardedProtocol)
    ? `${forwardedProtocol.toLowerCase()}:`
    : request.nextUrl.protocol;

  let sameOrigin = false;
  if (originHeader && host) {
    try {
      const origin = new URL(originHeader);
      sameOrigin = origin.host === host && origin.protocol === protocol;
    } catch {
      sameOrigin = false;
    }
  } else if (!originHeader) {
    sameOrigin = fetchSite === "same-origin";
  }

  if (sameOrigin) return NextResponse.next();

  console.warn(JSON.stringify({
    type: "security_event",
    event: "csrf_rejected",
    route: request.nextUrl.pathname,
    method: request.method,
    timestamp: new Date().toISOString(),
  }));
  return NextResponse.json({ error: "Origen no permitido" }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

export const config = { matcher: "/api/:path*" };
