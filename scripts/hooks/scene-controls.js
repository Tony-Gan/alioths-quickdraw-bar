import { MODULE_ID } from "../constants.js";
import { getDashboardInstance, openDashboard, closeDashboard } from "../utils/dashboard-api.js";

const TOOL_ID = "aqb-open";

export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isTrusted) return;

    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    const app = getDashboardInstance();
    const isActive = Boolean(app?.rendered);

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
    ui.controls?.render();
  });
}