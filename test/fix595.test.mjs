import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerArmorPreset } from "../index.js";

const index = readFileSync(new URL("../index.js", import.meta.url), "utf8");

test("0.5.95: registers both the armor preset and the guiji-channel preset", async () => {
  const defs = [];
  const registry = {
    async register(def) {
      defs.push(def);
      return async () => {};
    },
    async resolve() {
      return { id: "armor" };
    },
  };
  const result = await registerArmorPreset(registry);
  assert.equal(result.error, "");
  assert.equal(typeof result.release, "function");
  assert.equal(defs.length, 2, "armor + armor-guiji");
  assert.equal(defs[0].id, "armor");
  assert.equal(defs[1].id, "armor-guiji");
  const modelRow = defs[1].plugins.find((r) => r.id === "agent-default-model");
  assert.ok(modelRow, "guiji preset must pin a default model");
  assert.equal(modelRow.config.provider, "guijiliudon");
});

test("0.5.95: a second preset routes to the guijiliudon channel", () => {
  assert.match(index, /id: "armor-guiji"/);
  assert.match(index, /name: "@deepseek-ai\/dsh-agent-default-model"/);
  assert.match(index, /provider: "guijiliudon"/);
  assert.match(index, /model: "deepseek-ai\/DeepSeek-V4-Flash"/);
});

test("0.5.95: the guiji preset can be disabled and never breaks the main preset", () => {
  assert.match(index, /process\.env\.GEN4_GUIJI_PRESET !== "0"/);
  assert.match(index, /guijiRelease = null/);
  assert.match(index, /release: releaseAll/);
});
