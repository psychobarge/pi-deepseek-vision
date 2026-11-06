import { test } from "node:test";
import assert from "node:assert/strict";
import { config, sameModel } from "../lib/config.ts";

test("sameModel ignores ./ prefix, case and :latest", () => {
  assert.ok(sameModel("./qwen.gguf", "qwen.gguf"));
  assert.ok(sameModel("Qwen2.5VL:7B", "qwen2.5vl:7b"));
  assert.ok(sameModel("qwen2.5vl:latest", "qwen2.5vl"));
  assert.ok(!sameModel("qwen2.5vl:7b", "qwen2.5vl"));
});

test("timeout falls back to default when invalid", () => {
  for (const v of [undefined, "", "abc", "0", "-5"]) {
    if (v === undefined) delete process.env.VISION_TIMEOUT_MS;
    else process.env.VISION_TIMEOUT_MS = v;
    assert.equal(config().timeoutMs, 120_000, `VISION_TIMEOUT_MS=${v}`);
  }
  process.env.VISION_TIMEOUT_MS = "5000";
  assert.equal(config().timeoutMs, 5000);
});

test("API key adds Authorization header", () => {
  process.env.VISION_API_KEY = "k";
  assert.equal(config().headers.Authorization, "Bearer k");
  delete process.env.VISION_API_KEY;
  assert.equal(config().headers.Authorization, undefined);
});
