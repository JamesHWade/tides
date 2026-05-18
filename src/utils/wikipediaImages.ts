// Runtime fetch of Wikipedia article thumbnails for wildlife notes.
//
// We use the public Wikipedia REST summary endpoint, which is CORS-enabled
// and returns a thumbnail URL, an extract, and the article page URL.
// Wikipedia text is licensed CC BY-SA; attribution is satisfied by linking
// the article in the UI. Image files come from Wikimedia Commons and carry
// their own licenses (CC BY-SA / CC BY / public-domain depending on file) —
// we surface the Wikipedia article link as the source-of-truth attribution
// rather than trying to extract per-file license metadata.
//
// Results are cached in localStorage for 30 days so the wildlife card
// doesn't refetch on every render. A negative cache (null result) is also
// stored to avoid re-hammering 404s.

export type WikiImage = {
  /** The page title we queried with (may differ from canonical). */
  query: string;
  /** Canonical title returned by the API. */
  title: string;
  thumbnail: string | null;
  originalImage: string | null;
  extract: string | null;
  pageUrl: string;
};

const CACHE_KEY = "tides.wiki-images.v1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CacheEntry = { ts: number; img: WikiImage | null };
type Cache = Record<string, CacheEntry>;

function isValidImage(v: unknown): v is WikiImage {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.query === "string" &&
    typeof o.title === "string" &&
    typeof o.pageUrl === "string" &&
    (o.thumbnail === null || typeof o.thumbnail === "string") &&
    (o.originalImage === null || typeof o.originalImage === "string") &&
    (o.extract === null || typeof o.extract === "string")
  );
}

function isValidEntry(v: unknown): v is CacheEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Number.isFinite(o.ts)) return false;
  if (o.img !== null && !isValidImage(o.img)) return false;
  return true;
}

function loadCache(): Cache {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // Drop any entry whose shape doesn't match — a corrupted or older-schema
    // value would otherwise satisfy `cacheHit` and return `undefined` to
    // callers that expect `WikiImage | null`.
    const out: Cache = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidEntry(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or private mode — fine, we just refetch next visit.
  }
}

function cacheHit(cache: Cache, key: string): CacheEntry | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry;
}

/**
 * Fetch a single Wikipedia summary. Returns null when the page is missing
 * or the fetch fails. Use Promise.allSettled to fan out for multiple titles.
 */
export async function fetchWikipediaImage(
  title: string,
  signal?: AbortSignal,
): Promise<WikiImage | null> {
  const cache = loadCache();
  const hit = cacheHit(cache, title);
  if (hit) return hit.img;

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title,
  )}?redirect=true`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // Only negative-cache "this page really doesn't exist" — 404/410.
      // 429s and 5xxs are transient (rate-limit, outage); poisoning the
      // cache for 30 days on a brief blip would hide thumbnails long
      // after the upstream recovered.
      if (res.status === 404 || res.status === 410) {
        cache[title] = { ts: Date.now(), img: null };
        saveCache(cache);
      }
      return null;
    }
    const json = (await res.json()) as {
      title?: string;
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const img: WikiImage = {
      query: title,
      title: json.title ?? title,
      thumbnail: json.thumbnail?.source ?? null,
      originalImage: json.originalimage?.source ?? null,
      extract: json.extract ?? null,
      pageUrl:
        json.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
    cache[title] = { ts: Date.now(), img };
    saveCache(cache);
    return img;
  } catch {
    // Network/abort/parse — don't poison the cache so a later retry works.
    return null;
  }
}

/**
 * Synchronously read whatever's already in the cache without firing a fetch.
 * Used by the hook to render immediately on warm visits.
 */
export function cachedImageFor(title: string): WikiImage | null {
  const cache = loadCache();
  const hit = cacheHit(cache, title);
  return hit ? hit.img : null;
}
