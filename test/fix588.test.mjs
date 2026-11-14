import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frameOpening, isImageProductText, IMAGE_REANCHOR } from "../opening.js";

const CRITIQUE = readFileSync(new URL("./fixtures/image-critique.txt", import.meta.url), "utf8");

test("0.5.88: image frame is tool-form, not advice-form", () => {
  const f = frameOpening(CRITIQUE, { turn: 8, anyTurn: true });
  assert.equal(f.changed, true);
  assert.equal(f.kind, "image-product");
  assert.ok(f.frame.includes("第一个动作必须是工具调用"), "必须要求先调工具");
  assert.ok(f.frame.includes("原分辨率成品文件"), "必须要求成品文件");
  assert.ok(f.frame.includes("未完成"), "必须有完成判据");
  assert.ok(f.frame.includes("不要求用户另做样张"), "不得把任务推回给用户做样张");
  for (const bad of ["SPECIMEN 版", "请提供", "你可以选择"]) {
    assert.ok(!f.frame.includes(bad), `${bad} leaked`);
  }
});

test("0.5.88: image reanchor repeats the tool-first rule", () => {
  assert.ok(IMAGE_REANCHOR.includes("先调工具读原图"));
  assert.ok(IMAGE_REANCHOR.includes("只有文字或清单＝未完成"));
});

test("0.5.88: response discipline carries the tool-first clause", () => {
  const ack = readFileSync(new URL("../prompts/response-discipline.md", import.meta.url), "utf8");
  assert.ok(ack.includes("成品任务先调工具"));
  assert.ok(ack.includes("0 次工具调用"));
  assert.ok(ack.includes("不交替代品"));
});

test("0.5.88: image class still detected and instruction untouched", () => {
  assert.equal(isImageProductText(CRITIQUE), true);
  assert.ok(CRITIQUE.startsWith("1. 明显的AI生成瑕疵"));
});
