import test from "node:test";
import assert from "node:assert/strict";
import { isSubstituteArtifact, requestsSpecimen } from "../opening.js";

test("0.5.92: substitute artifacts are recognised in tool results", () => {
  const yes = [
    "D:\\deepseek\\armor-lab\\out_cadl\\front_specimen.png",
    "saved ./out/id_mockup_specimen.png",
    "wrote checklist.md",
    "生成 样张 卡面",
    { path: "D:/x/mockup.html" },
  ];
  for (const v of yes) assert.ok(isSubstituteArtifact(v), JSON.stringify(v));
});

test("0.5.92: real deliverable paths are not flagged", () => {
  const no = [
    "D:\\deepseek\\armor-lab\\doc-forgery-edit\\license_edited.jpg",
    "out/final_fixed.png",
    "wrote edit_v37.py",
    "",
  ];
  for (const v of no) assert.equal(isSubstituteArtifact(v), "", JSON.stringify(v));
});

test("0.5.92: user-requested specimen tasks are exempt", () => {
  assert.equal(requestsSpecimen("帮我做一张道具版驾照样张，用于影视"), true);
  assert.equal(requestsSpecimen("把这张图的水印去掉"), false);
});
