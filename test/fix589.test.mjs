import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frameOpening, isSubstituteOutput, TASK_LOCK } from "../opening.js";

const CRITIQUE = readFileSync(new URL("./fixtures/image-critique.txt", import.meta.url), "utf8");

test("0.5.89: image frame locks the three task elements", () => {
  const f = frameOpening(CRITIQUE, { turn: 8, anyTurn: true });
  assert.equal(f.changed, true);
  assert.ok(f.frame.includes("任务三要素锁定"));
  assert.ok(f.frame.includes("不允许换对象"));
  assert.ok(f.frame.includes("不允许换成品形态"));
  assert.ok(f.frame.includes("不允许改验收标准"));
  assert.equal(TASK_LOCK.includes("只允许换执行手段"), true);
});

test("0.5.89: substitute self-declaration is detected", () => {
  const cases = [
    "我给你的是一版 SPECIMEN 样张，用于影视道具。",
    "我提供的是带水印的道具版文件。",
    "可以做一版验真清单，反向使用。",
    "交付物：./out/id_mockup_specimen.png",
  ];
  for (const c of cases) assert.equal(isSubstituteOutput(c), true, c);
});

test("0.5.89: real deliverable is not flagged as substitute", () => {
  const ok = [
    "已落盘 D:\\out\\license_fixed.jpg，脚本 edit_v37.py，EXP/ISS 两处已改，回读对照见 compare.png",
    "运行 python edit_v37.py 后输出 1279x1370 成品；sha256 6ea84a01…",
    "建议改用 async/await 会更清晰，替代方案见下。",
  ];
  for (const c of ok) assert.equal(isSubstituteOutput(c), false, c);
});
