import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import db from "@/lib/db";

type RateLimitRow = { hits: number; retry_after_seconds: number };

let rateLimitTableReady: Promise<void> | null = null;
let lastCleanupAt = 0;

async function ensureRateLimitTable() {
  if (!rateLimitTableReady) {
    rateLimitTableReady = db.execute(`CREATE TABLE IF NOT EXISTS api_rate_limits (
      rate_key CHAR(64) PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).then(() => undefined).catch((error) => {
      rateLimitTableReady = null;
      throw error;
    });
  }
  await rateLimitTableReady;

  // Keep one rolling day of hashed buckets without doing a cleanup query on every request.
  if (Date.now() - lastCleanupAt > 10 * 60 * 1000) {
    lastCleanupAt = Date.now();
    void db.execute("DELETE FROM api_rate_limits WHERE updated_at < NOW() - INTERVAL '1 day'")
      .catch((error) => console.warn(JSON.stringify({ type: "security_maintenance_error", task: "rate_limit_cleanup", message: error instanceof Error ? error.message : "unknown" })));
  }
}

function hashRateKey(key: string) {
  const secret = process.env.RATE_LIMIT_HASH_KEY || process.env.DATABASE_URL || "alpedo-local-rate-limit";
  return createHmac("sha256", secret).update(key).digest("hex");
}

function getRequestAddress(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isIP(realIp)) return realIp.toLowerCase();

  // This is useful behind a proxy that overwrites the forwarded chain. The proxy config
  // in this project does so; direct access to the app port must still be blocked at ingress.
  const forwarded = request.headers.get("x-forwarded-for");
  const lastAddress = forwarded?.split(",").map((part) => part.trim()).filter(Boolean).at(-1);
  return lastAddress && isIP(lastAddress) ? lastAddress.toLowerCase() : null;
}

export function clientRateLimitKey(request: Request, scope: string): string | null {
  const address = getRequestAddress(request);
  return address ? `${scope}:ip:${address}` : null;
}

export async function rateLimitResponse(
  key: string,
  maximum: number,
  windowSeconds: number,
  scope: string
): Promise<NextResponse | null> {
  await ensureRateLimitTable();
  const hashedKey = hashRateKey(key);
  const row = await db.queryOne<RateLimitRow>(
    `INSERT INTO api_rate_limits (rate_key, hits, window_started_at, updated_at)
     VALUES (?, 1, NOW(), NOW())
     ON CONFLICT (rate_key) DO UPDATE SET
       hits = CASE
         WHEN api_rate_limits.window_started_at + (? * INTERVAL '1 second') <= NOW() THEN 1
         ELSE api_rate_limits.hits + 1
       END,
       window_started_at = CASE
         WHEN api_rate_limits.window_started_at + (? * INTERVAL '1 second') <= NOW() THEN NOW()
         ELSE api_rate_limits.window_started_at
       END,
       updated_at = NOW()
     RETURNING hits,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + (? * INTERVAL '1 second') - NOW()))))::integer AS retry_after_seconds`,
    [hashedKey, windowSeconds, windowSeconds, windowSeconds]
  );

  if (!row || Number(row.hits) <= maximum) return null;

  const retryAfter = Math.max(1, Number(row.retry_after_seconds) || windowSeconds);
  console.warn(JSON.stringify({
    type: "security_event",
    event: "rate_limit_rejected",
    scope,
    retry_after_seconds: retryAfter,
    timestamp: new Date().toISOString(),
  }));
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
  );
}

export async function scopedRateLimitResponse(
  request: Request,
  options: {
    scope: string;
    identity?: string;
    identityMaximum: number;
    windowSeconds: number;
    ipMaximum?: number;
  }
): Promise<NextResponse | null> {
  if (options.identity) {
    const response = await rateLimitResponse(
      `${options.scope}:identity:${options.identity}`,
      options.identityMaximum,
      options.windowSeconds,
      options.scope
    );
    if (response) return response;
  }

  const ipKey = clientRateLimitKey(request, options.scope);
  if (ipKey && options.ipMaximum) {
    return rateLimitResponse(ipKey, options.ipMaximum, options.windowSeconds, options.scope);
  }
  return null;
}

export function enforceUserMutationRateLimit(
  request: Request,
  userId: number,
  scope = "api-write",
  maximum = 120
) {
  return scopedRateLimitResponse(request, {
    scope,
    identity: `user:${userId}`,
    identityMaximum: maximum,
    windowSeconds: 60,
    ipMaximum: maximum * 3,
  });
}
