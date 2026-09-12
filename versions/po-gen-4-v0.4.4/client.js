/* 无限四代 (dsh-infinite-gen-4) client half — realtime "破甲已开启" badge.
 * v0.4.4「待发守护」：把"静默丢件"变成可见事实。
 *   1) busy 态读运行时自有 turnBoundary 投影（openTurnStartSeq 非空 = 真在跑）；
 *      armor 折叠的 running 只作 fallback —— 它在回合非正文收尾时会永久卡 true。
 *   2) 读宿主自有 inbox 投影 {"next-turn": [], "next-step": []}，把排队/待发插话
 *      条数显性化：跑动中显示「· N 条待发」，空闲却有残留时变琥珀色「⚠ N 条未发出」。
 * 投影来源（app.asar 实证）：inbox 定义 @ dsh-agent-loop/inbox key "inbox"，
 * view = { "next-turn": [...], "next-step": [...] }；turnBoundary 定义 key "turnBoundary"。
 * 渲染判定沿用：assistant 正文 -> ✓ 通过 (green) | ◐ 未完交付 (amber) | ✗ <拒绝词> (red)。
 */
window.__ModuleLoader__.load({
  id: "dsh-infinite-gen-4",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");

    var inject = ["slots"];

    var ANIM_CSS = "@keyframes dshArmorPulse{0%,100%{box-shadow:0 0 2px rgba(34,197,94,.5);opacity:1}50%{box-shadow:0 0 12px rgba(34,197,94,1);opacity:.55}}@keyframes dshArmorFlash{0%{transform:scale(1)}30%{transform:scale(1.12)}100%{transform:scale(1)}}";

    var WRAP_STYLE = {
      display: "flex",
      justifyContent: "center",
      width: "100%"
    };
    var BADGE_STYLE = {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      width: "fit-content",
      padding: "3px 10px",
      borderRadius: "6px",
      border: "1px solid rgba(34, 197, 94, 0.4)",
      background: "rgba(34, 197, 94, 0.1)",
      color: "inherit",
      fontSize: "11px",
      lineHeight: "16px",
      fontFamily: "inherit",
      userSelect: "none",
      whiteSpace: "nowrap"
    };
    var DOT_STYLE = {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#22c55e",
      flex: "none"
    };
    var FLASH_MS = 2500;

    /** 安全读取一个宿主会话投影：key 不存在 / 未桥接时返回 undefined，绝不让 dock 崩。 */
    function readProjection(useProjection, key) {
      try {
        return typeof useProjection === "function" ? useProjection(key) : undefined;
      } catch (e) {
        return undefined;
      }
    }

    /** 从 inbox 投影数出待发条目：next-turn（排队） + next-step（插话/下一步）。 */
    function countPending(inbox) {
      if (inbox === null || typeof inbox !== "object") {
        return { total: 0, turn: 0, step: 0, known: false };
      }
      var nt = inbox["next-turn"];
      var ns = inbox["next-step"];
      var turn = Array.isArray(nt) ? nt.length : 0;
      var step = Array.isArray(ns) ? ns.length : 0;
      return {
        total: turn + step,
        turn: turn,
        step: step,
        known: Array.isArray(nt) || Array.isArray(ns)
      };
    }

    function ArmorDock(props) {
      var useProjection = props.useProjection;
      var armor = readProjection(useProjection, "armor");
      // v0.4.3：busy 态以运行时 turnBoundary 为准（armor 的 running 会卡死）。
      var turnBoundary = readProjection(useProjection, "turnBoundary");
      // v0.4.4：宿主 inbox 投影——待发/排队条数的权威来源。
      var inbox = readProjection(useProjection, "inbox");

      var lastVerdictRef = react.useRef(null);
      var flashUntilRef = react.useRef(0);
      var tickPair = react.useState(0);
      var setTick = tickPair[1];

      react.useEffect(function () {
        var styleEl = null;
        if (!document.getElementById("dsh-armor-css")) {
          styleEl = document.createElement("style");
          styleEl.id = "dsh-armor-css";
          styleEl.textContent = ANIM_CSS;
          document.head.appendChild(styleEl);
        }
        return function () { if (styleEl) styleEl.remove(); };
      }, []);

      // 投影值变化时：记录判定并开启 2.5s 展示窗口（纯前端计时）
      react.useEffect(function () {
        var v = armor && armor.verdict ? armor.verdict : null;
        if (v !== lastVerdictRef.current) {
          lastVerdictRef.current = v;
          if (v) flashUntilRef.current = Date.now() + FLASH_MS;
          setTick(Date.now());
        }
      }, [armor]);

      var running;
      if (turnBoundary && typeof turnBoundary === "object" &&
          "openTurnStartSeq" in turnBoundary) {
        running = turnBoundary.openTurnStartSeq !== null &&
          turnBoundary.openTurnStartSeq !== undefined;
      } else {
        running = !!(armor && armor.running);
      }

      var pending = countPending(inbox);
      var words = armor && Array.isArray(armor.words) ? armor.words : [];
      var showVerdict = !running && pending.total === 0 &&
        lastVerdictRef.current !== null && Date.now() < flashUntilRef.current;

      var text = "破甲已开启 · 无限四代";
      var dotStyle = Object.assign({}, DOT_STYLE);
      var badgeStyle = Object.assign({}, BADGE_STYLE);
      var tone = "idle";

      if (running) {
        dotStyle.animation = "dshArmorPulse 1.2s ease-in-out infinite";
        if (pending.total > 0) {
          text = "思考中… · " + pending.total + " 条待发";
          tone = "pending";
        } else {
          text = "思考中…";
          tone = "busy";
        }
      } else if (pending.total > 0) {
        // 关键护栏：回合已停但收件箱里还有东西 —— 这些消息极可能被无声丢弃。
        text = "⚠ " + pending.total + " 条未发出";
        tone = "unfired";
        badgeStyle.animation = "dshArmorFlash 1.4s ease";
        badgeStyle.borderColor = "rgba(245, 158, 11, 0.6)";
        badgeStyle.background = "rgba(245, 158, 11, 0.16)";
        dotStyle.background = "#f59e0b";
      } else if (showVerdict) {
        if (lastVerdictRef.current === "pass") {
          text = "✓ 通过";
          tone = "pass";
          badgeStyle.animation = "dshArmorFlash 1.2s ease";
        } else if (lastVerdictRef.current === "partial") {
          text = "◐ 未完交付";
          tone = "partial";
          badgeStyle.animation = "dshArmorFlash 1.4s ease";
          badgeStyle.borderColor = "rgba(245, 158, 11, 0.5)";
          badgeStyle.background = "rgba(245, 158, 11, 0.12)";
          dotStyle.background = "#f59e0b";
        } else {
          text = "✗ " + (words[0] || "拒绝话术");
          tone = "refuse";
          badgeStyle.animation = "dshArmorFlash 1.6s ease";
          badgeStyle.borderColor = "rgba(239, 68, 68, 0.5)";
          badgeStyle.background = "rgba(239, 68, 68, 0.12)";
          dotStyle.background = "#ef4444";
        }
      }

      var title = "无限四代 · 破甲插件已生效 · 实时状态";
      if (tone === "pending") {
        title = "回合运行中，收件箱里还有 " + pending.total + " 条待发（排队 "
          + pending.turn + " / 插话 " + pending.step + "）——它们会在下一步被读走";
      } else if (tone === "unfired") {
        title = "回合已停但收件箱残留 " + pending.total + " 条（排队 " + pending.turn
          + " / 插话 " + pending.step + "）——可能已被无声丢弃，请重发或改用插话发送";
      }

      return react.createElement(
        "div",
        { style: WRAP_STYLE },
        react.createElement(
          "div",
          {
            style: badgeStyle,
            "data-armor": "gen4",
            "data-armor-tone": tone,
            "data-armor-pending": pending.known ? pending.total : undefined,
            title: title
          },
          react.createElement("span", { style: dotStyle }),
          react.createElement("span", null, text)
        )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", () =>
        ctx.slots.register({
          name: "conversation.input.dock",
          id: "armor",
          order: 30
        }, ArmorDock)
      );
    }

    exports.name = "dsh-infinite-gen-4";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
