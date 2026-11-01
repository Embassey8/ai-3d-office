import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rateLimit";

beforeEach(resetRateLimits);

describe("rateLimit", () => {
  it("allows up to the limit then blocks with a retry-after", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("u", 3, 60_000, 1000).ok).toBe(true);
    const blocked = rateLimit("u", 3, 60_000, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });
  it("resets after the window and isolates keys", () => {
    for (let i = 0; i < 4; i++) rateLimit("a", 3, 1000, 0);
    expect(rateLimit("a", 3, 1000, 1500).ok).toBe(true);
    expect(rateLimit("b", 3, 1000, 0).ok).toBe(true);
  });
});
