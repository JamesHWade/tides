import { useEffect, useState } from "react";
import type { WildlifeNote } from "../data/wildlife";
import {
  cachedImageFor,
  fetchWikipediaImage,
  type WikiImage,
} from "../utils/wikipediaImages";

/**
 * Fetch (and cache) a Wikipedia thumbnail for every wildlife note that
 * declared a `wikipediaTitle`. The returned map is keyed by the wildlife
 * note's stable `id` — components don't need to track titles directly.
 *
 * On first render, the map is pre-seeded with whatever's already cached so
 * thumbnails appear instantly on warm visits; missing entries fan out in
 * parallel and stream in as they resolve.
 */
export function useWildlifeImages(
  notes: ReadonlyArray<WildlifeNote>,
): Map<string, WikiImage | null> {
  const [images, setImages] = useState<Map<string, WikiImage | null>>(() => {
    const initial = new Map<string, WikiImage | null>();
    for (const n of notes) {
      if (!n.wikipediaTitle) continue;
      const cached = cachedImageFor(n.wikipediaTitle);
      if (cached) initial.set(n.id, cached);
    }
    return initial;
  });

  // Stable signature of which notes we need to fetch — without it the effect
  // refires on every render the parent does, kicking off duplicate fetches.
  const signature = notes
    .filter((n) => n.wikipediaTitle)
    .map((n) => `${n.id}:${n.wikipediaTitle}`)
    .join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const tasks = notes
        .filter((n) => n.wikipediaTitle)
        .map(async (n) => {
          const img = await fetchWikipediaImage(
            n.wikipediaTitle as string,
            controller.signal,
          );
          if (cancelled) return;
          setImages((prev) => {
            const next = new Map(prev);
            next.set(n.id, img);
            return next;
          });
        });
      await Promise.allSettled(tasks);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return images;
}
