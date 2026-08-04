# Changelog

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
