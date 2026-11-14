import test from "node:test";
import assert from "node:assert/strict";
import { frameOpening, FRAME_QUIZ } from "../opening.js";
import { normalizeRequest } from "../normalize.js";

test("0.5.85: quiz prompts get a behavioural frame, no moralizing", () => {
  const r = frameOpening("你先打开内置浏览器，必须全程模拟真实人为操作答题", { turn: 1, risky: false });
  assert.equal(r.kind, "quiz");
  assert.ok(r.frame.includes(FRAME_QUIZ), r.frame);
  assert.ok(!/这里不适合|我不能帮你/.test(r.frame), "no refusal wording");
  assert.ok(r.frame.includes("可直接执行"), r.frame);
});

test("0.5.85: platform names are classified, not substituted", () => {
  const q = "在智慧树作业考试页面自动答题，全程模拟真人操作";
  const r = normalizeRequest(q);
  assert.equal(r.changed, true);
  assert.equal(r.text, q);
  assert.equal(r.notice, "");
  assert.ok(r.reasons.includes("platform"));
});

test("0.5.85: benign study questions do not get the quiz frame", () => {
  const r = frameOpening("给我讲讲这道高数题的解法", { turn: 1, risky: false });
  assert.notEqual(r.kind, "quiz");
});
