import { describe, expect, it } from "vitest";
import { TtlCache } from "../cache";

describe("TtlCache", () => {
  it("serves an entry while it is fresh", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "value", 1000, undefined, 0);
    expect(cache.fresh("a", 999)?.value).toBe("value");
  });

  it("stops serving an entry as fresh once the TTL passes", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "value", 1000, undefined, 0);
    expect(cache.fresh("a", 1001)).toBeUndefined();
  });

  it("still hands back an expired entry to peek, for stale fallbacks", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "value", 1000, undefined, 0);
    expect(cache.peek("a")?.value).toBe("value");
  });

  it("keeps the revalidation token alongside the value", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "value", 1000, "Wed, 21 Aug 2026 10:00:00 GMT");
    expect(cache.peek("a")?.revalidateToken).toBe(
      "Wed, 21 Aug 2026 10:00:00 GMT",
    );
  });

  it("pushes the expiry out on extend, as a 304 should", () => {
    const cache = new TtlCache<string>();
    cache.set("a", "value", 1000, undefined, 0);
    cache.extend("a", 5000, 900);
    expect(cache.fresh("a", 5000)?.value).toBe("value");
  });

  it("evicts the oldest key past the limit", () => {
    const cache = new TtlCache<string>(2);
    cache.set("a", "1", 1000);
    cache.set("b", "2", 1000);
    cache.set("c", "3", 1000);
    expect(cache.peek("a")).toBeUndefined();
    expect(cache.peek("c")?.value).toBe("3");
  });

  it("treats re-setting a key as recent, not as its original insertion", () => {
    const cache = new TtlCache<string>(2);
    cache.set("a", "1", 1000);
    cache.set("b", "2", 1000);
    cache.set("a", "1-again", 1000);
    cache.set("c", "3", 1000);
    // "b" is now the oldest, so "a" survives.
    expect(cache.peek("a")?.value).toBe("1-again");
    expect(cache.peek("b")).toBeUndefined();
  });
});
