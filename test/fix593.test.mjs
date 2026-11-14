import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePreheat } from "../preheat.js";

const CWD = "D:\\armor-lab";

test("0.5.93: image preheat cites real workspace files", () => {
  const r = buildImagePreheat({ cwd: CWD });
  // 工作区里必然有 doc-forgery-edit 目录，若没有则跳过（CI 环境可能为空）。
  if (!r) return;
  assert.ok(r.notice.includes("[frame-preheat]"));
  assert.ok(r.notice.includes("底图："));
  assert.ok(r.images.length > 0);
  assert.ok(r.images.length <= 3);
  // 不得夹带任务指令或替代交付物字样
  for (const bad of ["SPECIMEN", "道具", "样张版", "请你", "必须"]) {
    assert.ok(!r.notice.includes(bad), bad);
  }
});

test("0.5.93: missing workspace returns null instead of throwing", () => {
  assert.equal(buildImagePreheat({ cwd: "D:\\no-such-workspace-xyz" }), null);
});
