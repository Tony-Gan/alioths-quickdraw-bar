import { MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { registerSceneControls } from "./hooks/scene-controls.js";
import { preloadAqbTemplates } from "./utils/templates.js";

Hooks.once("init", async () => {
  registerSettings();
  registerSceneControls();
  await preloadAqbTemplates();

  globalThis.AliothsQuickdrawBar = {
    open: async () => {
      const { openDashboard } = await import("./utils/dashboard-api.js");
      return openDashboard();
    },
    close: async () => {
      const { closeDashboard } = await import("./utils/dashboard-api.js");
      return closeDashboard();
    }
  };
});


Hooks.once("ready", () => {});
