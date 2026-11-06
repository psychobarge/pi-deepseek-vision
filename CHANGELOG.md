# Changelog

## Unreleased

- Add: `VISION_FORCE=1` routes images through the vision model even when the active
  model is declared image-capable (e.g. `deepseek-flash`), to keep images local.
- Fix: startup check and `/vision` now send `VISION_API_KEY` to `/models`, so
  servers requiring a key (OpenAI, OpenRouter) no longer report "unreachable: HTTP 401".
- Fix: an invalid or empty `VISION_TIMEOUT_MS` now falls back to 120000 ms instead
  of failing every vision call.
- Fix: multiple pasted images are now described one after another, so each call
  gets its own timeout and single-request local servers no longer time out.
- Refactor: startup check and `/vision` share a single `listModels()` helper.

## 0.0.1 - 2025-08-04

Initial release.

- Intercepts pasted images and `read` calls on image files, routes them to any
  OpenAI-compatible vision server (llama.cpp, Ollama, vLLM, LM Studio, OpenRouter).
- Config via env vars: `VISION_BASE_URL`, `VISION_MODEL`, `VISION_API_KEY`, `VISION_TIMEOUT_MS`.
- Startup health check: notifies when vision is not functional (missing config,
  unreachable server, model not found).
- `/vision` command: validate server URL/port and list available models.
- Editable vision prompt (`agents/vision.md`) with user override support.
- No-op when the active model already supports images.
