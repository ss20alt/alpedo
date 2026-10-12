import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-origin browser requests that could use the user's session cookie. */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method)) {
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

    if (!sameOrigin) {
      console.warn(JSON.stringify({
        type: "security_event",
        event: "csrf_rejected",
        route: pathname,
        method: request.method,
        timestamp: new Date().toISOString(),
      }));
      return NextResponse.json({ error: "Origen no permitido" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (pathname.startsWith("/api/")) return NextResponse.next();

  const nonce = randomBytes(16).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = { matcher: ["/", "/api/:path*"] };
