import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { fromAnthropicContent, toAnthropicMessages, toAnthropicTools, toProviderError } from "./anthropic";
import { estimateCostUsd } from "./pricing";
import { getProvider, ProviderError, type Message } from "./index";

describe("Anthropic message translation", () => {
  const thinking = { type: "thinking", thinking: "", signature: "sig-123" };
  const serverUse = { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "x" } };

  it("keeps thinking and server-tool blocks as opaque and replays them byte-for-byte", () => {
    const sdkContent = [
      thinking, serverUse,
      { type: "text", text: "Found it." },
      { type: "tool_use", id: "tu_1", name: "save_memory", input: { content: "hi" } },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];

    const blocks = fromAnthropicContent(sdkContent);
    expect(blocks.map((b) => b.type)).toEqual(["opaque", "opaque", "text", "tool_use"]);

    const msgs: Message[] = [{ role: "assistant", content: blocks }];
    const wire = toAnthropicMessages(msgs)[0].content as unknown[];
    expect(wire[0]).toBe(thinking);        // same object: untouched
    expect(wire[1]).toBe(serverUse);
    expect(wire[2]).toEqual({ type: "text", text: "Found it." });
    expect(wire[3]).toEqual({ type: "tool_use", id: "tu_1", name: "save_memory", input: { content: "hi" } });
  });

  it("maps tool results to the API shape, including errors", () => {
    const wire = toAnthropicMessages([{ role: "user", content: [{ type: "tool_result", toolUseId: "tu_1", content: "nope", isError: true }] }]);
    expect(wire[0].content).toEqual([{ type: "tool_result", tool_use_id: "tu_1", content: "nope", is_error: true }]);
  });

  it("sends function tools with a schema and server tools exactly as specified", () => {
    const out = toAnthropicTools([
      { kind: "function", name: "save_memory", description: "d", inputSchema: { type: "object", properties: {} } },
      { kind: "server", provider: "anthropic", name: "web_search", spec: { type: "web_search_20260209", name: "web_search", max_uses: 5 } },
    ]) as unknown as Record<string, unknown>[];
    expect(out[0]).toMatchObject({ name: "save_memory", input_schema: { type: "object" } });
    expect(out[1]).toEqual({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
  });
});

describe("error classification", () => {
  const err = (status: number, message = "boom") => Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message } }, message, new Headers());

  it.each([
    [429, "rate_limit", true],
    [500, "overloaded", true],
    [529, "overloaded", true],
    [401, "auth", false],
    [403, "auth", false],
    [400, "bad_request", false],
    [404, "bad_request", false],
  ])("HTTP %i -> %s (retryable=%s)", (status, kind, retryable) => {
    const pe = toProviderError(err(status));
    expect(pe).toBeInstanceOf(ProviderError);
    expect(pe.kind).toBe(kind);
    expect(pe.retryable).toBe(retryable);
  });

  it("treats aborts as retryable and passes ProviderErrors through", () => {
    expect(toProviderError(new Anthropic.APIUserAbortError()).kind).toBe("aborted");
    const original = new ProviderError("x", "auth", false);
    expect(toProviderError(original)).toBe(original);
  });
});

describe("pricing", () => {
  const u = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 };
  it("estimates from list prices", () => {
    expect(estimateCostUsd("claude-opus-5-5", u)).toBe(24);
    expect(estimateCostUsd("claude-sonnet-5-5", u)).toBe(12);
    expect(estimateCostUsd("claude-opus-5-5", { ...u, inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 })).toBeCloseTo(0.4, 6);
  });
  it("returns null (never a made-up number) for unknown models", () => {
    expect(estimateCostUsd("some-future-model", u)).toBeNull();
  });
});

describe("provider registry", () => {
  it("requires an API key and rejects unimplemented providers", () => {
    expect(() => getProvider("anthropic", {})).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => getProvider("openai", { anthropicApiKey: "k" })).toThrow(/not implemented/);
    expect(getProvider("anthropic", { anthropicApiKey: "k" }).name).toBe("anthropic");
  });
});
