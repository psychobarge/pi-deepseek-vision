// Pure helpers, kept out of extensions/ so tests can import them without pi installed.
export function config() {
  const baseUrl = (process.env.VISION_BASE_URL ?? "http://localhost:11434/v1").replace(/\/+$/, "");
  const model = process.env.VISION_MODEL ?? "";
  const apiKey = process.env.VISION_API_KEY ?? "";
  const t = Number(process.env.VISION_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(t) && t > 0 ? t : 120_000; // NaN/0 would break AbortSignal.timeout
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return { baseUrl, model, headers, timeoutMs };
}

// llama.cpp lists "./x.gguf", Ollama serves "x" as "x:latest"
const norm = (id: string) => id.replace(/^\.\//, "").replace(/:latest$/i, "").toLowerCase();
export const sameModel = (a: string, b: string) => norm(a) === norm(b);
