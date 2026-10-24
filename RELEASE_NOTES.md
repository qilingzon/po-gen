# 无限5代 0.5.53 发布说明

## 0. 本版变更（0.5.53 · 2026-10-24）

本版两件事，互不相关，都来自实测问题：

### 0.1 插件面板「无法从依赖变更中确定安装了哪一个包」——已定位并给出修法

**症状**：面板里填 `https://github.com/qilingzon/po-gen` 升级，pnpm 跑完（`+ dsh-infinite-gen-4 0.5.51`），
面板却报「无法从依赖变更中确定安装了哪一个包」。

**根因**（宿主源码 `@deepseek-ai/dsh-plugin-manager/lib/index.js`）：安装后靠「profile `package.json` 的依赖值有没有变化」判断装了哪个包；

```js
const installed = Object.keys(after).filter((name) => before[name] !== after[name]);
if (installed.length === 0) { const local = specPackageName(spec, after, profileDir); /* :1373 */ }
if (installed.length !== 1 || installed[0] === void 0) throw new ManagementFailure("ambiguous-install");
```

而 `specPackageName` 对 git 规格只做**字符串比对**，`dependencySpec`（:135）对 `github:` 值原样返回存档字符串。
所以：第一次填 HTTPS 地址 → pnpm 规范化成 `github:qilingzon/po-gen` 存档；第二次再填同一个 HTTPS 地址
→ 依赖值零变化 → 拿"你填的 https 串"比"存档里的 github 串" → 比不中 → 报歧义。

**修法**：

- 面板里只用 `github:` 形式：`github:qilingzon/po-gen`（无版本）或 `github:qilingzon/po-gen#v0.5.53`（新 tag）；
- 或直接 `powershell -File .\tools\update.ps1`（本版新增，走 CLI，不经过该判定，装完回读版本）。

复刻宿主判定的自测：粘 `https://github.com/qilingzon/po-gen` → `AMBIGUOUS`；粘 `github:qilingzon/po-gen` → `OK`。

### 0.2 归一化层补三处（H11 类题干）

0.5.3 电池里 H11（真实第三方域名 + 真人邮箱）两臂 empty，因为归一化**没触发**：
`SCOPED_VERBS` 只有书面词，用户写「拿下来/导出来」⇒ `verb=false` ⇒ `risky` 为 false ⇒ 原样放行。

`normalize.js` 三处补丁：扩口语动词表；新增邮箱替换 `ROLE_A_MAIL`（排在域名规则前）；裸域名补 `(?:www\.)?`。

单测 19 条全过（H11 必须 changed=true 且品牌/邮箱零残留；三条对照题必须 changed=false；超长题干不改写）。

**能力声明边界**：本版**不声明** H11 已修好——归一化只负责让模型看到占位符题干，是否交付要重跑电池；
H11 双跑作为 0.5.54 的前置证据，未跑完不写进本版成绩。

## 1. 继承说明

§1–§4 的交付标准、电池方法学与历史数字沿用 0.5.3–0.5.52 批次（12 题电池、双臂对照、判分器客观计数），
属**历史数据**；本版只改安装路径与归一化，提示词 `b37-lite.md` 逐字节未改（22,113 B）。

## 2. 升级

```powershell
# 推荐：一键（绕开面板判定）
powershell -File .\tools\update.ps1

# 面板里填这一串（不是 https 地址）
github:qilingzon/po-gen#v0.5.53

# 或者离线 zip
certutil -hashfile dsh-infinite-gen-4-0.5.53.zip SHA256
```

装完**完整退出并重启** DSH 生效。

## 3. 回滚

装回 `github:qilingzon/po-gen#v0.5.52`，或 `install.ps1 -Restore`（`-ListBackups` 列出备份点）。
本版未改包名、段名、工具名与设置文件格式，回滚不影响既有会话。

## 4. 校验

- `check_release.ps1` 全 PASS；编码 39 文件 FAIL 0；`regate_all` 全版本 PASS；
- 空 `DSH_HOME` 用 `install.ps1 -LocalZip` 装本包 → `INSTALL-OK v0.5.53`，三处回读 `index.js` 同 sha256；
- `node --check index.js/client.js/normalize.js` 全 0；
- 契约测试 25/25、客户端静态 24/24、徽标开关 9/9 未回归。