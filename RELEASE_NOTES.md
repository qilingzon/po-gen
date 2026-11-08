# RELEASE NOTES · po-gen v0.5.74

> 打包方式：`npm pack` → 解包为顶层目录 `po-gen/` → `Compress-Archive` 成 zip。
> 资产：`po-gen-0.5.74.zip` + `SHA256SUMS.txt`（GitHub Release 页同批挂载，digest 与本地 sha256 回读一致）。

## 0. 本版变更（0.5.74）

### 一、用户指令保真（核心）

- **原话逐字保存**：被归一化的用户消息，其原文写入该消息的 `source.originalText`，并附 `source.originalSha256`（前 12 位）、`source.transform`（替换类别）。会话落盘后可随时核对「用户说过什么」。
- **执行副本显式标注**：模型看到的正文是 `[归一化·执行副本] …`，声明「实名主体不进入交付、不作为请求对象；执行口径以副本为准，意图与边界以原话为准」。
- **无内联后门**：`GEN5_INLINE_NORMALIZE` / `GEN5_INLINE_OPENING` 已删除，任何环境变量都不会把改写搬回用户消息。
- 开场框定（`[开场框定]`）与归一化说明各自独立成插件消息，顺序：用户消息 → 开场框定。

### 二、为什么这么改

破甲的前提是「用户指令＝最高执行者」。旧实现用 `out[idx] = {...content:[{text: next}]}` 覆盖用户消息且不留原文，实例 `session-59e74155` 里原句已不可考——这等于用「伪造输入」换「输出合规」。0.5.74 把「保真」和「可执行」拆成两个字段：原文进 source，副本进 content。

### 三、不改的部分

- 提示词段、开场框定、执行基线（≥5 条可执行行）、重锚、`gen5_verify` 全部保留。

## 1. 安装

```powershell
# 桌面端
dsh plugin --profile desktop add github:qilingzon/po-gen#v0.5.74

# 实验 profile
dsh plugin --profile gen4-hl add github:qilingzon/po-gen#v0.5.74
```

装完确认 `profiles\<name>\package.json` 的 `dsh.profile.bundles` 含 `po-gen`。

## 2. 验证

```powershell
npm test            # 59/59
node tools/check-docs.mjs   # 文档版本一致性
```

会话内：`gen5_verify` → `preset-mounted`、`prompt-section`、`normalize` 三项应 pass。

## 3. 文件清单

- `index.js` / `opening.js` / `normalize.js` / `soft-reversal.js` / `preset-rows.js` / `client.js`
- `prompts/`（po-gen.md、po-gen-slim.md、response-discipline.md、变体库）
- `tools/`（build-preset-rows.mjs、check-docs.mjs、update.ps1 等）
- `test/`（59 例，含 `authority575.test.mjs`）
- 文档：README / HARNESS_PLUGIN / CHANGELOG / docs\COMPATIBILITY / DEPLOY_LINUX / SECURITY
