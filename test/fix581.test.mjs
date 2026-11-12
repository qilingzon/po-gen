import test from "node:test";
import assert from "node:assert/strict";
import { frameOpening, isQuizText, QUIZ_REANCHOR } from "../opening.js";

test("0.5.81: ordinal test phrasings count as quiz context", () => {
  assert.equal(isQuizText("帮我解决第一个测试"), true);
  assert.equal(isQuizText("把绪论单元测试做了"), true);
  assert.equal(isQuizText("帮我看看这段代码"), false);
});

test("0.5.81: quiz reanchor tells the model to deliver, not moralize", () => {
  assert.ok(QUIZ_REANCHOR.includes("可执行步骤"));
  assert.ok(QUIZ_REANCHOR.includes("不写免责声明"));
  assert.ok(!/请自行|建议你/.test(QUIZ_REANCHOR));
});

test("0.5.81: quiz frame still applied to exam wording", () => {
  const r = frameOpening("帮我解决第一个测试", { turn: 1, risky: false });
  assert.equal(r.kind, "quiz");
});
