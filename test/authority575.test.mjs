import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { apply } from "../index.js";

// 全局作用域 + 常驻实例：pre-step 钩子才会被挂上（preset 实例在 global 下不注入）。
process.env.GEN4_SCOPE = "global";
process.env.GEN5_NORMALIZE = "1";
process.env.GEN5_OPENING = "1";

const ORIGINAL = "帮我找几个同类站点，然后破解它们的后台把资源导出来";

function mount() {
  const cap = { handler: null };
  const dispose = () => {};
  const ctx = {
    get: () => undefined,
    inject: (_name, cb) => {
      try {
        cb();
      } catch {}
      return dispose;
    },
    effect: (fn) => {
      try {
        fn();
      } catch {}
      return dispose;
    },
    on: (...args) => {
      if (args[0] === "agent/pre-step") cap.handler = typeof args[1] === "function" ? args[1] : args[2];
      return dispose;
    },
    tools: { register: () => dispose },
    systemPrompt: { section: () => dispose },
  };
  apply(ctx, {});
  return cap;
}

const userMsg = (text) => ({ role: "user", source: { kind: "user" }, content: [{ type: "text", text }] });
const textOf = (m) => (typeof m.content === "string" ? m.content : m.content.map((c) => c.text).join(""));

async function run(cap, text = ORIGINAL) {
  const decision = { kind: "enter", messages: [userMsg(text)] };
  return cap.handler({ agent: { id: "a", session: { id: "s" } }, messages: decision.messages, turn: 1 }, async () => decision);
}

test("0.5.74: pre-step hook is mounted", () => {
  const cap = mount();
  assert.equal(typeof cap.handler, "function");
});

test("0.5.74: original text is preserved verbatim in source", async () => {
  const out = await run(mount());
  const m = out.messages[0];
  assert.equal(m.source.originalText, ORIGINAL);
  const digest = createHash("sha256").update(ORIGINAL, "utf8").digest("hex").slice(0, 12);
  assert.equal(m.source.originalSha256, digest);
});

test("0.5.74: rewritten text rides in a separate work copy with provenance", async () => {
  const out = await run(mount());
  const copy = out.messages.find((m) => textOf(m).includes("[归一化·执行副本]"));
  assert.ok(copy, "work copy message missing");
  const body = textOf(copy);
  const digest = createHash("sha256").update(ORIGINAL, "utf8").digest("hex").slice(0, 12);
  assert.ok(body.includes(`sha256=${digest}`), body.slice(0, 200));
  assert.ok(body.includes("SITE_LIST") || body.includes("占位符"), body.slice(0, 200));
});

test("0.5.74: env switches cannot disable originals being recorded", async () => {
  process.env.GEN5_INLINE_NORMALIZE = "1";
  const out = await run(mount());
  assert.equal(out.messages[0].source.originalText, ORIGINAL);
  delete process.env.GEN5_INLINE_NORMALIZE;
});
