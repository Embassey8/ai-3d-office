import { describe, expect, it } from "vitest";
import { AnthropicKeySchema } from "./anthropicKey";

describe("AnthropicKeySchema (format guard)", () => {
  const ok = "sk-ant-api03-" + "A".repeat(40);
  it("accepts a plausible key and trims whitespace", () => {
    expect(AnthropicKeySchema.parse(`  ${ok}  `)).toBe(ok);
  });
  it.each([
    ["empty", ""],
    ["too short", "sk-ant-abc"],
    ["wrong prefix", "sk-proj-" + "A".repeat(40)],
    ["contains spaces", "sk-ant-api03-" + "A".repeat(20) + " " + "B".repeat(20)],
    ["contains quotes", `"sk-ant-api03-${"A".repeat(40)}"`],
    ["way too long", "sk-ant-" + "A".repeat(400)],
  ])("rejects %s", (_n, v) => {
    expect(AnthropicKeySchema.safeParse(v).success).toBe(false);
  });
});
