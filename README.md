# pi-deepseek-vision

Give vision to DeepSeek (API, no native vision) through a **server-agnostic vision
subagent** for [pi](https://github.com/earendil-works/pi-coding-agent).

DeepSeek is a text-only model: pi replaces any image with
`(image omitted: model does not support images)` before it reaches the API. This
extension intercepts images at both entry points (pasted images and `read` tool
calls on image files) and sends them to a vision-capable model over a plain HTTP
call to any **OpenAI-compatible** endpoint (`/v1/chat/completions`). The
description comes back as text that DeepSeek can reason over. The "subagent" is a
dedicated model + dedicated prompt (`agents/vision.md`), no separate process.

## Features

- **Server-agnostic**: works with any OpenAI-compatible endpoint : llama.cpp,
  Ollama, vLLM, LM Studio, OpenRouter, OpenAI. Only env vars change.
- **Transparent**: pasted images are described and injected into the prompt; a
  `read` on an image file returns `[Vision: …]` instead of an omission note.
- **Self-diagnosing**: on session start, notifies you if the vision setup is
  broken (missing config, unreachable server, model not found).
- **`/vision` command**: validates the server URL/port and lists its models.
- No-op when the active model already supports images.

## Installation

```bash
pi install git:github.com/psychobarge/pi-deepseek-vision
```

## Configuration (env vars)

| Variable | Role | Default / examples |
|---|---|---|
| `VISION_BASE_URL` | Vision server URL + port | default `http://localhost:11434/v1` (Ollama); llama.cpp `http://localhost:8080/v1`, vLLM `http://localhost:8000/v1`, LM Studio `http://localhost:1234/v1`, OpenRouter `https://openrouter.ai/api/v1`, OpenAI `https://api.openai.com/v1` |
| `VISION_MODEL` | Model id on that server | **required** - `qwen2.5vl:7b`, `llava:13b`, `google/gemini-2.0-flash-001`, `gpt-4o-mini`, any vision model you want... |
| `VISION_API_KEY` | Optional (remote/authenticated servers) | `sk-or-...` |
| `VISION_TIMEOUT_MS` | Optional | default `120000` (slow local models) |

```bash
# local (llama.cpp, e.g. Gemma 3n vision)
export VISION_BASE_URL=http://127.0.0.1:8080/v1
export VISION_MODEL="./Gemma-3n-4b-Vision-Finetuned.i1-Q6_K.gguf"

# local (Ollama)
export VISION_MODEL=qwen2.5vl:7b            # baseUrl defaults to Ollama

# remote (OpenRouter)
export VISION_BASE_URL=https://openrouter.ai/api/v1
export VISION_MODEL=google/gemini-2.0-flash-001
export VISION_API_KEY=$OPENROUTER_API_KEY
```

Make sure the variables are exported in the shell before launching pi.

## Usage

- **Paste an image** (Ctrl+V / drag & drop) → described by the vision model, the
  description is injected into the prompt, DeepSeek reasons over it.
- **`read` on an image file** → the tool result is replaced with `[Vision: …]`.
- **On pi startup**: the extension checks the config and notifies you if vision is
  not functional (missing config, unreachable server, model not found on server).
- **`/vision`** → tests the server and lists its models (validate URL/port first).
- Active model already vision-capable → hooks are no-ops (no double handling).
- Failure (server down, wrong port, non-vision model) → notification, no crash;
  Esc/Ctrl+C aborts the call.

## The vision prompt

`agents/vision.md` is the system prompt sent to the vision model. Resolution
order: user override (`~/.pi/agent/agents/vision.md`) → prompt shipped with the
package → built-in default. Edit it to change how images are described.

## Tests

1. `ollama pull qwen2.5vl:7b` (or start your server), `/vision` → lists models.
2. Paste an image → the transformed message contains `[Vision of attached image: …]`.
3. Ask DeepSeek to read an image file → `[Vision: …]` as the `read` result.
4. Switching servers = changing `VISION_BASE_URL`/`VISION_MODEL`, nothing else.

## License

MIT
