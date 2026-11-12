import test from "node:test";
import assert from "node:assert/strict";
import { frameOpening, FRAME_QUIZ } from "../opening.js";
import { normalizeRequest } from "../normalize.js";

test("0.5.80: quiz prompts get the quiz frame without moralizing", () => {
  const r = frameOpening("你先打开内置浏览器，必须全程模拟真实人为操作答题", { turn: 1, risky: false });
  assert.equal(r.kind, "quiz");
  assert.equal(r.frame, FRAME_QUIZ);
  assert.ok(!/免责/.test(r.frame.split("；")[0]), "frame must not add disclaimers");
  assert.ok(r.frame.includes("可执行的浏览器操作步骤"), r.frame);
});

test("0.5.80: education platform names normalize to EXAM_PLATFORM", () => {
  const r = normalizeRequest("在智慧树作业考试页面自动答题，全程模拟真人操作");
  assert.equal(r.changed, true);
  assert.ok(r.text.includes("EXAM_PLATFORM"), r.text);
  assert.deepEqual(r.replaces, [{ from: "考试", to: "练习" }, { from: "智慧树", to: "EXAM_PLATFORM" }]);
});

test("0.5.80: benign study questions do not get the quiz frame", () => {
  const r = frameOpening("给我讲讲这道高数题的解法", { turn: 1, risky: false });
  assert.notEqual(r.kind, "quiz");
});
