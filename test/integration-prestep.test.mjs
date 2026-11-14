import test from "node:test";
import assert from "node:assert/strict";
import { activateForTest } from "../index.js";

// 0.5.96：集成测试——不依赖宿主 registry，直接把 activate() 挂到假 ctx 上，
// 走真实的 agent/pre-step 管线，断言框定/闸门确实进了请求消息。
function makeCtx() {
  const handlers = new Map();
  const ctx = {
    on(name, fn) {
      handlers.set(name, fn);
      return () => handlers.delete(name);
    },
    effect(fn) {
      try {
        const d = fn();
        return typeof d === "function" ? d : () => {};
      } catch {
        return () => {};
      }
    },
    inject(_names, cb) {
      if (typeof cb === "function") cb();
    },
    tools: {
      register() {
        return () => {};
      },
      restrict() {},
    },
    systemPrompt: { section: () => () => {} },
    sessionProjections: { register: () => ({ dispose() {} }) },
  };
  return { ctx, handlers };
}

function userMsg(text) {
  return { role: "user", content: [{ type: "text", text }], source: { kind: "user" } };
}

test("0.5.96: pre-step injects the product frame for a mid-session image task", async () => {
  const { ctx, handlers } = makeCtx();
  const dispose = activateForTest(ctx, { mode: "armor" }, true);
  try {
    const pre = handlers.get("agent/pre-step");
    assert.ok(pre, "agent/pre-step must be registered");
    const agent = { session: { id: "s-integration-1" } };
    const critique = "胆 1. 明显的AI生成瑕疵（图案变形）· 淘金者的双手糊在一起 帆船绳索断裂 微缩印刷 鬼影人像 字体与对齐 DD编号 帮我一次性解决";
    const decision = { kind: "enter", messages: [userMsg(critique)] };
    const out = await pre({ agent, messages: decision.messages, turn: 3 }, () => Promise.resolve(decision));
    assert.equal(out.kind, "enter");
    const notices = out.messages.filter(
      (m) => m && m.role === "user" && m.source && m.source.kind === "plugin:po-gen",
    );
    assert.ok(notices.length >= 1, "expected at least one plugin notice");
    const text = notices.map((m) => m.content.map((c) => c.text).join("")).join("\n");
    assert.match(text, /【硬口径】|执行框定/);
    // 用户原话必须逐字保留
    const userTexts = out.messages
      .filter((m) => m.role === "user" && m.source && m.source.kind === "user")
      .map((m) => m.content.map((c) => c.text).join(""));
    assert.ok(userTexts.includes(critique), "user text must be untouched");
  } finally {
    dispose();
  }
});

test("0.5.96: plain coding prompt gets no frame (no over-injection)", async () => {
  const { ctx, handlers } = makeCtx();
  const dispose = activateForTest(ctx, { mode: "armor" }, true);
  try {
    const pre = handlers.get("agent/pre-step");
    const agent = { session: { id: "s-integration-2" } };
    const q = "帮我把这个函数改成异步的，并补一个单元测试";
    const decision = { kind: "enter", messages: [userMsg(q)] };
    const out = await pre({ agent, messages: decision.messages, turn: 4 }, () => Promise.resolve(decision));
    const notices = out.messages.filter(
      (m) => m && m.source && m.source.kind === "plugin:po-gen",
    );
    assert.equal(notices.length, 0, "no frame for a plain coding prompt");
  } finally {
    dispose();
  }
});
