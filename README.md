# pi-deepseek-vision

[![npm version](https://img.shields.io/npm/v/pi-deepseek-vision?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-deepseek-vision)
[![license MIT](https://img.shields.io/npm/l/pi-deepseek-vision?style=flat-square)](LICENSE)
[![pi extension](https://img.shields.io/badge/pi-extension-7B61FF?style=flat-square)](https://github.com/earendil-works/pi)

Pi extension that adds an alternative vision path for DeepSeek: images are described by a model of your choice (local or remote) through a server-agnostic vision subagent.

DeepSeek can now read images, but you may prefer to keep them away from the API: privacy, cost, or a specialised local model. When the active model is not declared image-capable, pi replaces any image with `(image omitted: model does not support images)` before it reaches the API. This extension intercepts images at both entry points (pasted images and `read` tool calls on image files), sends them to a vision model over any **OpenAI-compatible** endpoint (`/v1/chat/completions`), and hands the description back to DeepSeek as text. The "subagent" is a dedicated model + dedicated prompt (`agents/vision.md`), no separate process.

## Features

- Local alternative to native vision: images can stay on your machine (llama.cpp, Ollama, vLLM, LM Studio)
- Server-agnostic: local servers or remote ones (OpenRouter, OpenAI) — only env vars change
- Transparent: pasted images are described and injected into the prompt; a `read` on an image file returns `[Vision: …]` instead of an omission note
- Self-diagnosing: on session start, notifies you if the vision setup is broken (missing config, unreachable server, model not found)
- `/vision` command: validates the server URL/port and lists its models
- No-op when the active model is declared image-capable in pi (native vision is used instead), unless `VISION_FORCE=1`

## Install

```sh
pi install npm:pi-deepseek-vision
# or
pi install git:github.com/psychobarge/pi-deepseek-vision
```

Restart pi or run `/reload` to activate.

## Configuration

| Variable | Role | Default / examples |
|---|---|---|
| `VISION_BASE_URL` | Vision server URL + port | default `http://localhost:11434/v1` (Ollama); llama.cpp `http://localhost:8080/v1`, vLLM `http://localhost:8000/v1`, LM Studio `http://localhost:1234/v1`, OpenRouter `https://openrouter.ai/api/v1`, OpenAI `https://api.openai.com/v1` |
| `VISION_MODEL` | Model id on that server | **required** — `qwen2.5vl:7b`, `llava:13b`, `google/gemini-2.0-flash-001`, `gpt-4o-mini`, any vision model |
| `VISION_API_KEY` | Optional (remote/authenticated servers) | `sk-or-...` |
| `VISION_TIMEOUT_MS` | Optional | default `120000` (slow local models) |
| `VISION_FORCE` | Optional: `1` = use the vision model even when the active model has native vision | default unset (native vision wins) |

```sh
# local (llama.cpp, e.g. Gemma 3n vision)
export VISION_BASE_URL=http://127.0.0.1:8080/v1
export VISION_MODEL="./Gemma-3n-4b-Vision-Finetuned.i1-Q6_K.gguf"

# local (Ollama)
export VISION_MODEL=qwen2.5vl:7b            # baseUrl defaults to Ollama
export VISION_FORCE=1                      # also for models with native vision

# remote (OpenRouter)
export VISION_BASE_URL=https://openrouter.ai/api/v1
export VISION_MODEL=google/gemini-2.0-flash-001
export VISION_API_KEY=$OPENROUTER_API_KEY
```

Export the variables in the shell before launching pi. Switching servers = changing `VISION_BASE_URL`/`VISION_MODEL`, nothing else.

### pi in Docker

`export` from inside pi then `/reload` does not work: pi's own environment is unchanged. Pass the variables when the container starts, and reach a server running on the host with `host.docker.internal` (`localhost` is the container itself). 
With [pi-sandbox](https://github.com/psychobarge/pi-sandbox), add them to `DOCKER_ARGS` in `pi.conf`:

```sh
DOCKER_ARGS=(-e PI_SKIP_VERSION_CHECK=1
  -e VISION_BASE_URL=http://host.docker.internal:8080/v1
  -e VISION_MODEL=./Gemma-3n-4b-Vision-Finetuned.i1-Q6_K.gguf
  -e VISION_FORCE=1)
```

`VISION_FORCE=1` is only needed if the active DeepSeek model is declared image-capable. With plain `docker run`, use `-e VISION_BASE_URL=...` etc.; on Linux without Docker Desktop, also add `--add-host=host.docker.internal:host-gateway`.

## Usage

- **Paste an image** (Ctrl+V / drag & drop) → described by the vision model, the description is injected into the prompt as `[Vision of attached image: …]`, DeepSeek reasons over it
- **`read` on an image file** → the tool result is replaced with `[Vision: …]`
- **On pi startup** → the extension checks the config and notifies you if vision is not functional
- Active model already vision-capable (e.g. `deepseek-flash`) → hooks are no-ops and images go to its native vision; set `VISION_FORCE=1` to keep using your vision model
- Failure (server down, wrong port, non-vision model) → notification, no crash; Esc/Ctrl+C aborts the call

### Commands

```sh
/vision    # test the server and list its models (validate URL/port first)
```

### The vision prompt

`agents/vision.md` is the system prompt sent to the vision model. Resolution order: user override (`~/.pi/agent/agents/vision.md`) → prompt shipped with the package → built-in default. Edit it to change how images are described.

## Development

Manual check:

1. `ollama pull qwen2.5vl:7b` (or start your server), then `/vision` → lists models
2. Paste an image → the transformed message contains `[Vision of attached image: …]`
3. Ask DeepSeek to read an image file → `[Vision: …]` as the `read` result

To test a local branch, `pi install /absolute/path/to/pi-deepseek-vision` (it replaces the npm version), then `/reload`; `pi install npm:pi-deepseek-vision` to switch back.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT
