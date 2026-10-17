import { describe, expect, it } from "vitest";
import {
  DEFAULT_OLLAMA_CONFIG,
  normalizeOllamaEndpoint,
  normalizeOllamaModel,
  readOllamaConfig,
  requestOllamaReply,
  writeOllamaConfig,
} from "../lib/ollama";

describe("local Ollama configuration", () => {
  it("accepts loopback URLs and rejects public hosts, credentials, and unsafe schemes", () => {
    expect(normalizeOllamaEndpoint("http://localhost:11434/")).toBe("http://localhost:11434");
    expect(normalizeOllamaEndpoint("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
    expect(normalizeOllamaEndpoint("https://[::1]:11434")).toBeNull();
    expect(normalizeOllamaEndpoint("http://user:secret@localhost:11434")).toBeNull();
    expect(normalizeOllamaEndpoint("https://assistant.example/api")).toBeNull();
    expect(normalizeOllamaEndpoint("javascript:alert(1)")).toBeNull();
  });

  it("validates model names and persists only endpoint and model", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(normalizeOllamaModel("llama3.2")).toBe("llama3.2");
    expect(normalizeOllamaModel("bad model")).toBeNull();
    expect(writeOllamaConfig({ endpoint: "http://localhost:11434/", model: "qwen2.5:7b" }, storage))
      .toEqual({ endpoint: "http://localhost:11434", model: "qwen2.5:7b" });
    expect(readOllamaConfig(storage)).toEqual({ endpoint: "http://localhost:11434", model: "qwen2.5:7b" });
    expect([...values.values()].join(" ")).not.toMatch(/secret|password|token/i);
  });

  it("falls back to defaults if saved settings are malformed", () => {
    const storage = { getItem: () => JSON.stringify({ endpoint: "https://remote.example", model: "bad model" }) };
    expect(readOllamaConfig(storage)).toEqual(DEFAULT_OLLAMA_CONFIG);
  });
});

describe("local Ollama chat request", () => {
  it("posts chat messages to the local API without credentials", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const reply = await requestOllamaReply(
      { endpoint: "http://localhost:11434", model: "llama3.2" },
      [{ role: "user", content: "Hello" }],
      undefined,
      async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(JSON.stringify({ message: { content: "Hi from Ollama" } }), { status: 200 });
      },
    );
    expect(reply).toBe("Hi from Ollama");
    expect(requestUrl).toBe("http://localhost:11434/api/chat");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(requestInit?.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({ model: "llama3.2", stream: false });
  });

  it("surfaces API and malformed response errors", async () => {
    await expect(requestOllamaReply(
      DEFAULT_OLLAMA_CONFIG,
      [],
      undefined,
      async () => new Response("missing model", { status: 404 }),
    )).rejects.toThrow(/HTTP 404/);
    await expect(requestOllamaReply(
      DEFAULT_OLLAMA_CONFIG,
      [],
      undefined,
      async () => new Response(JSON.stringify({ done: true }), { status: 200 }),
    )).rejects.toThrow(/did not include message text/);
  });
});
