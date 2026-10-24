/* 无限四代 (dsh-infinite-gen-4) client half — realtime "破甲已开启" badge.
 * Reads the host "armor" session projection via useProjection:
 *   user message -> breathing pulse "思考中…"
 *   assistant message -> ✓ 通过 (green flash) | ◐ 未完交付 (yellow flash)
 *                        | ✗ <拒绝词> (red flash)
 * 0.5.4：徽标点击 = 打开设置面板（不再是直接切换）。
 *   破甲模式：只有「其他模式显示徽标」一项（只管看得见）。
 *   其他模式：多一项「启用破甲」（= 是否给其他模式注入）；不开就不污染其他模式。
 *   设置走宿主 HTTP 路由 /gen4/scope：GET 读、POST 写（scope / showBadge 可单独写）。
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

    var SCOPE_URL = "/gen4/scope";
    var POLL_MS = 4000;
    var WRAP_STYLE = {
      position: "relative",
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
      whiteSpace: "nowrap",
      cursor: "pointer"
    };
    var DOT_STYLE = {
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "#22c55e",
      flex: "none"
    };
    var PANEL_STYLE = {
      position: "absolute",
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginBottom: "6px",
      minWidth: "236px",
      padding: "10px 12px",
      borderRadius: "8px",
      border: "1px solid rgba(148, 163, 184, 0.45)",
      background: "rgba(24, 24, 27, 0.97)",
      color: "#e5e7eb",
      fontSize: "12px",
      lineHeight: "18px",
      textAlign: "left",
      boxShadow: "0 8px 24px rgba(0,0,0,.35)",
      cursor: "default",
      zIndex: 40
    };
    var ROW_STYLE = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      padding: "4px 0"
    };
    var HINT_STYLE = {
      marginTop: "6px",
      color: "#9ca3af",
      fontSize: "11px",
      lineHeight: "15px"
    };
    var FLASH_MS = 2500;

    function readScope(done) {
      try {
        fetch(SCOPE_URL, { headers: { accept: "application/json" } })
          .then(function (res) { return res.json(); })
          .then(function (data) { done(data || null); })
          .catch(function () { done(null); });
      } catch {
        done(null);
      }
    }

    // payload: { scope } 或 { showBadge }（可同时）
    function writeSetting(payload, done) {
      try {
        fetch(SCOPE_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (res) { return res.json(); })
          .then(function (data) { done(data || null); })
          .catch(function () { done(null); });
      } catch {
        done(null);
      }
    }

    function switchStyle(on) {
      return {
        flex: "none",
        width: "32px",
        height: "18px",
        borderRadius: "9px",
        border: "none",
        padding: "0",
        cursor: "pointer",
        position: "relative",
        background: on ? "#22c55e" : "rgba(148, 163, 184, 0.45)",
        transition: "background .15s ease"
      };
    }

    function knobStyle(on) {
      return {
        position: "absolute",
        top: "2px",
        left: on ? "16px" : "2px",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "#fff",
        transition: "left .15s ease"
      };
    }

    function ArmorDock(props) {
      var useProjection = props.useProjection;
      var preset = typeof useProjection === "function"
        ? useProjection("agentPreset")
        : undefined;
      var armor = typeof useProjection === "function"
        ? useProjection("armor")
        : undefined;

      var scopePair = react.useState(null);
      var scope = scopePair[0];
      var setScope = scopePair[1];
      var badgePair = react.useState(false);
      var showBadge = badgePair[0];
      var setShowBadge = badgePair[1];
      // 0.5.5：按对话覆盖表 { "<会话id>": "on" | "off" }，来自宿主设置文件。
      var sessionsPair = react.useState({});
      var sessions = sessionsPair[0];
      var setSessions = sessionsPair[1];
      var openPair = react.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var busyPair = react.useState(false);
      var busy = busyPair[0];
      var setBusy = busyPair[1];
      var notePair = react.useState("");
      var note = notePair[0];
      var setNote = notePair[1];
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

      // 设置轮询：徽标点击后、scope.ps1 改过设置、另一个窗口改过，都能同步。
      react.useEffect(function () {
        var alive = true;
        var apply = function (data) {
          if (!alive || !data) return;
          if (typeof data.scope === "string") setScope(data.scope);
          if (typeof data.showBadge === "boolean") setShowBadge(data.showBadge);
          if (data.sessions && typeof data.sessions === "object") setSessions(data.sessions);
          if (data.envOverride) setNote("范围已被环境变量 GEN4_SCOPE 固定：" + data.envOverride);
        };
        readScope(apply);
        var timer = setInterval(function () { readScope(apply); }, POLL_MS);
        return function () { alive = false; clearInterval(timer); };
      }, []);

      // 点面板外面关掉
      react.useEffect(function () {
        if (!open) return undefined;
        var close = function (event) {
          var el = event && event.target;
          if (el && el.closest && el.closest("[data-gen4-panel]")) return;
          setOpen(false);
        };
        document.addEventListener("mousedown", close, true);
        return function () { document.removeEventListener("mousedown", close, true); };
      }, [open]);

      // 投影值变化时：记录判定并开启 2.5s 展示窗口（纯前端计时）
      react.useEffect(function () {
        var v = armor && armor.verdict ? armor.verdict : null;
        if (v !== lastVerdictRef.current) {
          lastVerdictRef.current = v;
          if (v) flashUntilRef.current = Date.now() + FLASH_MS;
          setTick(Date.now());
        }
      }, [armor]);

      var global = scope === "global";
      var isArmor = preset === "armor";
      // 0.5.5：本对话。armor 投影带 sessionId，据此在设置里查这场对话的显式覆盖。
      var mySessionId = armor && armor.sessionId ? String(armor.sessionId) : "";
      var myOverride = mySessionId && sessions ? sessions[mySessionId] : undefined;
      // 没覆盖时跟随设置：破甲会话默认开，其他模式默认跟随全局。
      var sessionOn = myOverride === "on"
        ? true
        : (myOverride === "off" ? false : (isArmor || global));
      var sessionKnown = mySessionId !== "";
      // 可见性：破甲模式永远显示；其他模式要么开了「显示徽标」，要么处于全局启用，
      // 要么这场对话被单独打开过（否则打开面板的入口本身就不见了）。
      var visible = isArmor || global || showBadge === true || myOverride === "on";
      if (!visible) return null;

      var running = !!(armor && armor.running);
      var words = armor && Array.isArray(armor.words) ? armor.words : [];
      var showVerdict = !running && lastVerdictRef.current !== null &&
        Date.now() < flashUntilRef.current;

      var text = isArmor
        ? (sessionOn ? "破甲已开启 · 无限四代" : "破甲已停用 · 本对话")
        : (sessionOn
          ? (global && myOverride !== "on" ? "破甲已开启 · 全部模式" : "破甲已开启 · 本对话")
          : "破甲未启用 · 点击开启");
      var dotStyle = Object.assign({}, DOT_STYLE);
      var badgeStyle = Object.assign({}, BADGE_STYLE);
      if (!sessionOn) {
        badgeStyle.borderColor = "rgba(148, 163, 184, 0.5)";
        badgeStyle.background = "rgba(148, 163, 184, 0.12)";
        dotStyle.background = "#94a3b8";
      }

      if (running) {
        dotStyle.animation = "dshArmorPulse 1.2s ease-in-out infinite";
        text = "思考中…";
      } else if (showVerdict) {
        if (lastVerdictRef.current === "pass") {
          text = "✓ 通过";
          badgeStyle.animation = "dshArmorFlash 1.2s ease";
        } else if (lastVerdictRef.current === "partial") {
          text = "◐ 未完交付";
          badgeStyle.animation = "dshArmorFlash 1.4s ease";
          badgeStyle.borderColor = "rgba(245, 158, 11, 0.5)";
          badgeStyle.background = "rgba(245, 158, 11, 0.12)";
          dotStyle.background = "#f59e0b";
        } else {
          text = "✗ " + (words[0] || "拒绝话术");
          badgeStyle.animation = "dshArmorFlash 1.6s ease";
          badgeStyle.borderColor = "rgba(239, 68, 68, 0.5)";
          badgeStyle.background = "rgba(239, 68, 68, 0.12)";
          dotStyle.background = "#ef4444";
        }
      }

      if (note) text = note;
      if (busy) badgeStyle.opacity = "0.6";

      function toggle() {
        if (busy) return;
        if (note) setNote("");
        setOpen(!open);
      }

      function commit(payload) {
        if (busy) return;
        setBusy(true);
        writeSetting(payload, function (data) {
          setBusy(false);
          if (data && data.ok) {
            if (typeof data.scope === "string") setScope(data.scope);
            if (typeof data.showBadge === "boolean") setShowBadge(data.showBadge);
            if (data.sessions && typeof data.sessions === "object") setSessions(data.sessions);
            return;
          }
          var code = data && data.error;
          if (code === "env-override" || code === "env-override-badge") {
            setNote("已被环境变量固定，无法在界面切换");
          } else if (code === "sessionId" || code === "session") {
            setNote("这场对话还没有会话 id，稍后再试");
            setTimeout(function () { setNote(""); }, 4000);
          } else {
            setNote("保存失败，请重试");
            setTimeout(function () { setNote(""); }, 4000);
          }
        });
      }

      // 本对话开关：开 → 显式 on；关 → 显式 off；有过覆盖时可一键回到「跟随设置」。
      function commitSession(next) {
        if (!sessionKnown) {
          setNote("这场对话还没有会话 id，稍后再试");
          setTimeout(function () { setNote(""); }, 4000);
          return;
        }
        if (next === "auto") commit({ sessionId: mySessionId, session: "auto" });
        else commit({ sessionId: mySessionId, session: next });
      }

      var title = isArmor
        ? "点击打开破甲设置"
        : (sessionOn ? "破甲已在当前对话启用 · 点击打开设置" : "当前对话未启用破甲 · 点击打开设置");

      var rows = [];
      // 0.5.5：本对话一行。三态（显式开 / 显式关 / 跟随设置），关掉只影响这一场。
      if (sessionKnown) {
        rows.push(react.createElement(
          "div",
          { key: "session", style: ROW_STYLE },
          react.createElement(
            "span",
            { style: { display: "flex", flexDirection: "column", gap: "2px" } },
            react.createElement("span", null, "本对话启用破甲"),
            react.createElement(
              "span",
              { style: { color: "#9ca3af", fontSize: "10px", lineHeight: "13px" } },
              myOverride === "on"
                ? "仅这场：已打开（" + mySessionId.slice(0, 8) + "…）"
                : (myOverride === "off"
                  ? "仅这场：已关闭（" + mySessionId.slice(0, 8) + "…）"
                  : "跟随上面的设置")
            )
          ),
          react.createElement(
            "span",
            { style: { display: "flex", alignItems: "center", gap: "6px", flex: "none" } },
            react.createElement("button", {
              type: "button",
              "aria-label": "本对话启用破甲",
              "data-gen4-toggle": "session",
              "aria-pressed": sessionOn ? "true" : "false",
              style: switchStyle(sessionOn),
              onClick: function () { commitSession(sessionOn ? "off" : "on"); }
            }, react.createElement("span", { style: knobStyle(sessionOn) })),
            myOverride
              ? react.createElement("button", {
                type: "button",
                "data-gen4-session-reset": "1",
                title: "恢复跟随上面的设置",
                onClick: function () { commitSession("auto"); },
                style: {
                  flex: "none",
                  background: "transparent",
                  border: "none",
                  color: "#93c5fd",
                  fontSize: "11px",
                  padding: "0",
                  cursor: "pointer"
                }
              }, "跟随")
              : null
          )
        ));
      }
      if (!isArmor) {
        rows.push(react.createElement(
          "div",
          { key: "scope", style: ROW_STYLE },
          react.createElement("span", null, "启用破甲（其他模式）"),
          react.createElement("button", {
            type: "button",
            "aria-label": "启用破甲",
            "data-gen4-toggle": "scope",
            "aria-pressed": global ? "true" : "false",
            style: switchStyle(global),
            onClick: function () { commit({ scope: global ? "local" : "global" }); }
          }, react.createElement("span", { style: knobStyle(global) }))
        ));
      }
      rows.push(react.createElement(
        "div",
        { key: "badge", style: ROW_STYLE },
        react.createElement("span", null, "其他模式显示徽标"),
        react.createElement("button", {
          type: "button",
          "aria-label": "其他模式显示徽标",
          "data-gen4-toggle": "badge",
          "aria-pressed": showBadge ? "true" : "false",
          style: switchStyle(showBadge),
          onClick: function () { commit({ showBadge: !showBadge }); }
        }, react.createElement("span", { style: knobStyle(showBadge) }))
      ));

      var hint = isArmor
        ? "「本对话」只影响当前这场；上面的「其他模式显示徽标」只管看得见。"
        : (global
          ? "当前所有模式都注入；把「本对话」关掉只影响这一场。"
          : "当前只有破甲模式注入；打开「本对话」只给这一场开。");

      var panel = open
        ? react.createElement(
          "div",
          { style: PANEL_STYLE, "data-gen4-panel": "settings", role: "dialog", "aria-label": "破甲设置" },
          react.createElement("div", { style: { fontWeight: 600, marginBottom: "4px" } }, "破甲设置"),
          rows,
          react.createElement("div", { style: HINT_STYLE }, hint)
        )
        : null;

      return react.createElement(
        "div",
        { style: WRAP_STYLE },
        panel,
        react.createElement(
          "div",
          {
            style: badgeStyle,
            "data-armor": "gen4",
            "data-scope": scope || "unknown",
            "data-show-badge": showBadge ? "1" : "0",
            "data-session-id": mySessionId ? mySessionId.slice(0, 12) : "",
            "data-session-state": myOverride || "auto",
            "data-session-on": sessionOn ? "1" : "0",
            role: "button",
            tabIndex: 0,
            title: title,
            onClick: toggle,
            onKeyDown: function (event) {
              if (event.key === "Enter" || event.key === " ") toggle();
            }
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
