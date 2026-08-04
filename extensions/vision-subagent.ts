// ~/.pi/agent/extensions/vision-subagent.ts
// Server-agnostic vision: any OpenAI-compatible endpoint (/v1/chat/completions).
// Config: VISION_BASE_URL, VISION_MODEL, VISION_API_KEY (opt), VISION_TIMEOUT_MS (opt)
//   ollama http://localhost:11434/v1 | llama.cpp http://localhost:8080/v1
//   vLLM http://localhost:8000/v1 | LM Studio http://localhost:1234/v1
//   openrouter https://openrouter.ai/api/v1 | openai https://api.openai.com/v1
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const VISION_AGENT = join(homedir(), ".pi", "agent", "agents", "vision.md");
// Prompt shipped with the package (when installed via pi install): ../agents/vision.md
const PACKAGE_AGENT = join(dirname(fileURLToPath(import.meta.url)), "..", "agents", "vision.md");
const DEFAULT_PROMPT =
  "You are a vision specialist. Describe images exhaustively: all visible text verbatim, " +
  "UI layout, colors, code, error messages, icons. Be precise and structured.";

function config() {
  const baseUrl = (process.env.VISION_BASE_URL ?? "http://localhost:11434/v1").replace(/\/+$/, "");
  const model = process.env.VISION_MODEL ?? "";
  const apiKey = process.env.VISION_API_KEY ?? "";
  const timeoutMs = Number(process.env.VISION_TIMEOUT_MS ?? 120_000);
  return { baseUrl, model, apiKey, timeoutMs };
}

function readPrompt(p: string): string | undefined {
  if (existsSync(p)) {
    const { body } = parseFrontmatter(readFileSync(p, "utf8"));
    if (body.trim()) return body.trim();
  }
  return undefined;
}

// Resolution order: user override (~/.pi/agent/agents) → package prompt → built-in default
function systemPrompt(): string {
  return readPrompt(VISION_AGENT) ?? readPrompt(PACKAGE_AGENT) ?? DEFAULT_PROMPT;
}

function callSignal(ctx: ExtensionContext, timeoutMs: number): AbortSignal {
  const sigs = [AbortSignal.timeout(timeoutMs)];
  if (ctx.signal) sigs.push(ctx.signal); // Esc/Ctrl+C aborts the call
  return AbortSignal.any(sigs);
}

async function describe(data: string, mimeType: string, question: string, ctx: ExtensionContext): Promise<string> {
  const { baseUrl, model, apiKey, timeoutMs } = config();
  if (!model) throw new Error(`VISION_MODEL is not set (server: ${baseUrl}) - e.g. export VISION_MODEL=qwen2.5vl:7b`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: callSignal(ctx, timeoutMs),
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } },
        ] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  const text = out.choices?.[0]?.message?.content;
  if (!text) throw new Error("vision: empty response - does the model support images?");
  return text;
}

async function checkVisionOnStartup(ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) return; // No UI (print/json): nothing to notify
  const { baseUrl, model } = config();
  if (!model) {
    ctx.ui.notify(
      `Vision not configured: VISION_MODEL is missing (server: ${baseUrl}) - export VISION_MODEL=qwen2.5vl:7b`,
      "error",
    );
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ids = ((await res.json()).data ?? []).map((m: any) => m.id);
    const norm = (id: string) => id.replace(/^\.\//, "").toLowerCase();
    if (ids.length === 0 || !ids.some((id: string) => norm(id) === norm(model))) {
      ctx.ui.notify(
        `Vision: model "${model}" not found on ${baseUrl} - available: ${ids.slice(0, 5).join(", ") || "(none)"}`,
        "warn",
      );
    }
  } catch (e: any) {
    ctx.ui.notify(`Vision ${baseUrl} unreachable: ${e.message}`, "error");
  }
}

export default function (pi: ExtensionAPI) {
  // At session start: warn if vision is not functional
  pi.on("session_start", async (_event, ctx) => {
    await checkVisionOnStartup(ctx);
  });

  // Diagnostic: validate URL/port and list the server's models
  pi.registerCommand("vision", {
    description: "Test the vision server (VISION_BASE_URL) and list its models",
    handler: async (_args, ctx) => {
      const { baseUrl, timeoutMs } = config();
      try {
        const res = await fetch(`${baseUrl}/models`, { signal: callSignal(ctx, timeoutMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ids = ((await res.json()).data ?? []).map((m: any) => m.id);
        ctx.ui.notify(`Vision ${baseUrl}: ${ids.length} model(s) - ${ids.slice(0, 8).join(", ") || "(empty)"}`, "info");
      } catch (e: any) {
        ctx.ui.notify(`Vision ${baseUrl} unreachable: ${e.message}`, "error");
      }
    },
  });

  // Pasted image (Ctrl+V) → described, description injected, image dropped
  pi.on("input", async (event, ctx) => {
    if (!event.images?.length || ctx.model?.input.includes("image")) return { action: "continue" };
    const images = event.images;
    try {
      const parts = await Promise.all(images.map((img, i) =>
        describe(img.data, img.mimeType,
          `Image ${i + 1}/${images.length}: describe it very precisely (text, UI, code, visible errors).`, ctx)
      ));
      return {
        action: "transform",
        text: `[Vision of attached image:\n${parts.join("\n\n")}]\n\n${event.text}`,
        images: [],
      };
    } catch (e: any) {
      ctx.ui.notify(`vision: ${e.message}`, "error");
      return { action: "continue" }; // pi applies its usual omission
    }
  });

  // DeepSeek runs read on an image → replace content with the description
  pi.on("tool_result", async (event, ctx) => {
    const img = event.content.find((c): c is { type: "image"; data: string; mimeType: string } => c.type === "image");
    if (event.toolName !== "read" || !img || ctx.model?.input.includes("image")) return;
    try {
      const text = await describe(img.data, img.mimeType,
        "Describe this image very precisely (text, UI, code, errors).", ctx);
      return { content: [{ type: "text", text: `[Vision: ${text}]` }] };
    } catch (e: any) {
      ctx.ui.notify(`vision: ${e.message}`, "error");
    }
  });
}
