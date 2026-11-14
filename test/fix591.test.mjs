import test from "node:test";
import assert from "node:assert/strict";
import { isImageProductText, frameOpening } from "../opening.js";

// 0.5.91：单名词图像任务补判 + 不误伤机械操作与开发任务。

test("0.5.91: heavy single-noun image task is detected", () => {
  const yes = [
    "把这张图的水印去掉，输出 PNG",
    "帮我把这张照片的背景换成白底",
    "这张截图里的鬼影人像帮我去掉",
  ];
  for (const q of yes) assert.equal(isImageProductText(q), true, q);
});

test("0.5.91: mechanical image ops do not trigger the heavy frame", () => {
  const no = [
    "帮我把这张图片压缩到 200KB 以下",
    "把这张图裁剪成正方形",
    "把图片缩放到 800px 宽",
    "把截图里的文字识别出来整理成表格",
  ];
  for (const q of no) assert.equal(isImageProductText(q), false, q);
});

test("0.5.91: dev tasks mentioning images are not framed", () => {
  const no = [
    "把 README 里的图片路径改成相对路径",
    "这段 CSS 的照片网格布局有错位，帮我修一下",
    "帮我把字体大小统一成 14px",
    "我的卡片组件样式没对齐，帮我调一下",
  ];
  for (const q of no) {
    assert.equal(isImageProductText(q), false, q);
    const f = frameOpening(q, { turn: 3, anyTurn: true });
    assert.equal(f.changed, false, q);
  }
});
