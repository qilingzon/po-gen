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
      // 可见性：破甲模式永远显示；其他模式要么开了「显示徽标」，要么处于全局启用。
      var visible = isArmor || global || showBadge === true;
      if (!visible) return null;

      var running = !!(armor && armor.running);
      var words = armor && Array.isArray(armor.words) ? armor.words : [];
      var showVerdict = !running && lastVerdictRef.current !== null &&
        Date.now() < flashUntilRef.current;

      var text = isArmor
        ? "破甲已开启 · 无限四代"
        : (global ? "破甲已开启 · 全部模式" : "破甲未启用 · 点击开启");
      var dotStyle = Object.assign({}, DOT_STYLE);
      var badgeStyle = Object.assign({}, BADGE_STYLE);
      if (!isArmor && !global) {
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
            return;
          }
          var code = data && data.error;
          if (code === "env-override" || code === "env-override-badge") {
            setNote("已被环境变量固定，无法在界面切换");
          } else {
            setNote("保存失败，请重试");
            setTimeout(function () { setNote(""); }, 4000);
          }
        });
      }

      var title = isArmor
        ? "点击打开破甲设置"
        : (global ? "破甲已在全部模式启用 · 点击打开设置" : "破甲未在其他模式启用 · 点击打开设置");

      var rows = [];
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
        ? "勾选后其他模式也能看到徽标；是否注入由那里的「启用破甲」决定。"
        : (global
          ? "当前所有模式都注入破甲框架；关掉后只有破甲模式注入。"
          : "当前只有破甲模式注入；打开后其他模式也会注入。");

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
