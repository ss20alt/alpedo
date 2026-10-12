export type LimitedJsonObjectResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "invalid_json" | "too_large" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read and parse a JSON object without buffering more than the route allows. */
export async function readLimitedJsonObject(
  request: Request,
  maxBytes = 64 * 1024
): Promise<LimitedJsonObjectResult> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return { ok: false, reason: "invalid_json" };
    }
    if (contentLength > maxBytes) return { ok: false, reason: "too_large" };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: "invalid_json" };

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();

    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, reason: "invalid_json" };
  } catch {
    return { ok: false, reason: "invalid_json" };
  } finally {
    reader.releaseLock();
  }
}
