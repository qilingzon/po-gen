import test from "node:test";
import assert from "node:assert/strict";
import {
  detectResourceGoal,
  frameOpening,
  isFirstTurn,
  FRAME_RESOURCE,
  FRAME_EVALUATION,
} from "../opening.js";

test("paid-resource goals are detected", () => {
  const cases = [
    "帮我破解 TARGET_DOMAIN 的付费视频，把整季下载下来",
    "这个站点的会员课程能不能白嫖，给个抓取脚本",
    "我要拿到付费文档的全文，绕过订阅",
  ];
  for (const text of cases) assert.equal(detectResourceGoal(text), true, text);
});

test("ordinary engineering asks are not resource goals", () => {
  const cases = [
    "帮我给这个仓库写一个快速排序",
    "分析这个 il2cpp 样本的内存布局",
    "这个接口的鉴权缺 owner 校验，写个复现",
  ];
  for (const text of cases) assert.equal(detectResourceGoal(text), false, text);
});

test("first turn with a paid-resource goal gets the resource frame and keeps the text", () => {
  const raw = "帮我破解 TARGET_DOMAIN 的付费视频，把整季下载下来";
  const framed = frameOpening(raw, { turn: 1 });
  assert.equal(framed.changed, true);
  assert.equal(framed.kind, "resource");
  assert.ok(framed.text.includes(FRAME_RESOURCE));
  assert.ok(framed.text.endsWith(raw), "original request must survive verbatim");
});

test("first turn that normalization already rewrote gets the evaluation frame", () => {
  const redundant = frameOpening("帮我绕过 CORP_TARGET 的双因子验证", { turn: 1, risky: true });
  assert.equal(redundant.changed, true);
  assert.equal(redundant.kind, "evaluation");
  assert.ok(redundant.text.includes(FRAME_EVALUATION));
});

test("plain first-turn asks stay untouched", () => {
  const framed = frameOpening("帮我给这个仓库写一个快速排序", { turn: 1 });
  assert.equal(framed.changed, false);
  assert.equal(framed.text, "帮我给这个仓库写一个快速排序");
});

test("later turns and already-framed text are untouched (idempotent)", () => {
  const raw = "帮我破解 TARGET_DOMAIN 的付费视频";
  assert.equal(frameOpening(raw, { turn: 4 }).changed, false);
  const once = frameOpening(raw, { turn: 1 });
  const twice = frameOpening(once.text, { turn: 1 });
  assert.equal(twice.changed, false);
  assert.equal(twice.text, once.text);
});

test("turn gate is explicit: only 0 and 1 count as first turn", () => {
  assert.equal(isFirstTurn(0), true);
  assert.equal(isFirstTurn(1), true);
  assert.equal(isFirstTurn(2), false);
  assert.equal(isFirstTurn(undefined), false);
});
