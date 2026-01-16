import { MODULE_ID } from "../constants.js";
import { getDashboardInstance, openDashboard, closeDashboard } from "../utils/dashboard-api.js";

const TOOL_ID = "aqb-open";

export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    const app = getDashboardInstance();
    const isActive = Boolean(app?.element?.isConnected);

    tokenControls.tools[TOOL_ID] = {
      name: TOOL_ID,
      title: "打开 AQB",
      icon: "fas fa-bolt",
      order: Object.keys(tokenControls.tools).length,
      button: true,
      toggle: true,
      active: isActive,
      visible: true,
      onChange: async (event, active) => {
        try {
          if (active) await openDashboard();
          else await closeDashboard();
        } catch (err) {
          console.error("[AQB] 打开/关闭面板失败", err);
          ui.notifications?.error?.("AQB 打开失败：请查看 F12 控制台错误信息。");
        } finally {
          ui.controls?.render();
        }
      }
    };
  });

  Hooks.on("closeAqbDashboardApp", () => {
    try {
      const controls = ui.controls;
      const setToolInactive = (tool) => {
        if (tool && typeof tool === "object") tool.active = false;
      };

      const tokenCtl = controls?.controls?.find?.((c) => c?.name === "tokens");
      const tools = tokenCtl?.tools;
      if (Array.isArray(tools)) {
        setToolInactive(tools.find((t) => t?.name === TOOL_ID));
      } else if (tools && typeof tools === "object") {
        setToolInactive(tools[TOOL_ID]);
      }

      const curTools = controls?.control?.tools;
      if (Array.isArray(curTools)) {
        setToolInactive(curTools.find((t) => t?.name === TOOL_ID));
      } else if (curTools && typeof curTools === "object") {
        setToolInactive(curTools[TOOL_ID]);
      }
    } catch (_) { /* ignore */ }

    ui.controls?.render();
  });
}
