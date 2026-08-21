/**
 * A tiny in-process TTL cache with stale-on-error semantics.
 *
 * Both upstreams ask to be called sparingly — DMI throttles hard and MET
 * Norway's terms require caching — and in development React Strict Mode
 * double-mounts every effect, so without this the app hammers them on every
 * page load.
 *
 * This lives in module memory, which means one cache per server instance. On a
 * serverless platform that is per-lambda and cold starts drop it; a deployment
 * running more than one instance should move this behind Redis or the
 * platform's own data cache. It is deliberately small enough to swap out.
 */
export type CacheEntry<T> = {
  value: T;
  storedAt: number;
  /** Absolute time the entry stops being fresh. */
  expiresAt: number;
  /** Opaque revalidation token, e.g. an upstream `Last-Modified` header. */
  revalidateToken?: string;
};

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries = 32) {}

  /** The entry for `key` whether or not it has expired. */
  peek(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key);
  }

  /** The entry for `key`, only if it is still within its TTL. */
  fresh(key: string, now = Date.now()): CacheEntry<T> | undefined {
    const entry = this.entries.get(key);
    return entry && entry.expiresAt > now ? entry : undefined;
  }

  set(
    key: string,
    value: T,
    ttlMs: number,
    revalidateToken?: string,
    now = Date.now(),
  ): CacheEntry<T> {
    // Refresh insertion order so the eviction below drops the oldest key.
    this.entries.delete(key);
    const entry: CacheEntry<T> = {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
      revalidateToken,
    };
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    return entry;
  }

  /** Push an existing entry's expiry out, after a 304 revalidation. */
  extend(key: string, ttlMs: number, now = Date.now()): void {
    const entry = this.entries.get(key);
    if (entry) entry.expiresAt = now + ttlMs;
  }

  clear(): void {
    this.entries.clear();
  }
}
