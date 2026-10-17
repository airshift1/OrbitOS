export interface OllamaConfig {
  endpoint: string;
  model: string;
}

export interface OllamaMessage {
  role: "user" | "assistant";
  content: string;
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  endpoint: "http://localhost:11434",
  model: "llama3.2",
};

const STORAGE_KEY = "orbitos.ollama.v1";
const MAX_ENDPOINT_LENGTH = 500;
const MAX_MODEL_LENGTH = 100;

export function normalizeOllamaEndpoint(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_ENDPOINT_LENGTH) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isLoopback = host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";
    if (!isLoopback || !["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeOllamaModel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const model = raw.trim();
  return model.length > 0 && model.length <= MAX_MODEL_LENGTH && /^[\w][\w./:-]*$/.test(model)
    ? model
    : null;
}

export function readOllamaConfig(storage?: Pick<Storage, "getItem">): OllamaConfig {
  try {
    const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OLLAMA_CONFIG };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_OLLAMA_CONFIG };
    const record = value as Record<string, unknown>;
    const endpoint = normalizeOllamaEndpoint(record.endpoint);
    const model = normalizeOllamaModel(record.model);
    return endpoint && model ? { endpoint, model } : { ...DEFAULT_OLLAMA_CONFIG };
  } catch {
    return { ...DEFAULT_OLLAMA_CONFIG };
  }
}

export function writeOllamaConfig(
  config: OllamaConfig,
  storage?: Pick<Storage, "setItem">,
): OllamaConfig {
  const endpoint = normalizeOllamaEndpoint(config.endpoint);
  const model = normalizeOllamaModel(config.model);
  if (!endpoint || !model) throw new Error("Enter a loopback Ollama URL and a valid model name.");
  const normalized = { endpoint, model };
  (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function requestOllamaReply(
  config: OllamaConfig,
  messages: OllamaMessage[],
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const endpoint = normalizeOllamaEndpoint(config.endpoint);
  const model = normalizeOllamaModel(config.model);
  if (!endpoint || !model) throw new Error("Configure a valid local Ollama endpoint and model first.");

  let response: Response;
  try {
    response = await fetcher(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach Ollama. Check that it is running locally and allows this OrbitOS origin.");
  }
  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}. Check the selected model and local server.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Ollama returned an invalid response.");
  }
  if (!payload || typeof payload !== "object") throw new Error("Ollama returned an invalid response.");
  const message = (payload as { message?: { content?: unknown } }).message;
  if (!message || typeof message.content !== "string") throw new Error("Ollama response did not include message text.");
  return message.content;
}
