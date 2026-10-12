type SectionCacheEntry = {
  promise: Promise<unknown>;
  expiresAt: number;
  value?: unknown;
  resolved?: boolean;
};

const SECTION_CACHE_TTL_MS = 20_000;
const sectionDataCache = new Map<string, SectionCacheEntry>();

function cacheKey(userId: number, path: string) {
  return `${userId}:${path}`;
}

function requestSectionData<T>(path: string, userId: number, force = false): Promise<T> {
  if (!userId) return Promise.reject(new Error("La sesión venció. Iniciá sesión y probá de nuevo."));

  const key = cacheKey(userId, path);
  const cached = sectionDataCache.get(key);
  const isInFlight = cached?.expiresAt === Number.POSITIVE_INFINITY;
  if (cached && (isInFlight || (!force && cached.expiresAt > Date.now()))) {
    return cached.promise as Promise<T>;
  }

  const entry: SectionCacheEntry = {
    promise: Promise.resolve(null),
    expiresAt: Number.POSITIVE_INFINITY,
  };
  const request = fetch(path, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).then(async (response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "No se pudieron cargar los datos de esta sección.");
    }
    return data as T;
  });

  entry.promise = request;
  sectionDataCache.set(key, entry);
  void request.then(
    (data) => {
      if (sectionDataCache.get(key) === entry) {
        entry.value = data;
        entry.resolved = true;
        entry.expiresAt = Date.now() + SECTION_CACHE_TTL_MS;
      }
    },
    () => {
      if (sectionDataCache.get(key) === entry) sectionDataCache.delete(key);
    },
  );

  return request;
}

export function getPrefetchedSectionData<T>(path: string, userId: number) {
  return requestSectionData<T>(path, userId);
}

export function peekPrefetchedSectionData<T>(path: string, userId: number): T | null {
  if (!userId) return null;
  const entry = sectionDataCache.get(cacheKey(userId, path));
  return entry?.resolved && entry.expiresAt > Date.now() ? entry.value as T : null;
}

export function prefetchSectionData(path: string, userId: number) {
  return requestSectionData(path, userId);
}

export function refreshSectionData<T>(path: string, userId: number) {
  return requestSectionData<T>(path, userId, true);
}

export function clearPrefetchedSectionData(userId: number) {
  const prefix = `${userId}:`;
  for (const key of sectionDataCache.keys()) {
    if (key.startsWith(prefix)) sectionDataCache.delete(key);
  }
}
