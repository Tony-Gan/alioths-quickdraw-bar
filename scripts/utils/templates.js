import { MODULE_ID } from "../constants.js";

export async function preloadAqbTemplates() {
  try {
    const paths = [ // [MODIFIED]
      `modules/${MODULE_ID}/templates/dashboard.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-items.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-features.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-spells.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-checks-saves.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-state-movement.hbs`,
      `modules/${MODULE_ID}/templates/partials/tab-custom.hbs`,
      `modules/${MODULE_ID}/templates/partials/components/split-button.hbs`,
      `modules/${MODULE_ID}/templates/partials/components/item-button.hbs`,
      `modules/${MODULE_ID}/templates/partials/components/icon-toggle-button.hbs`
    ];


    await loadTemplates(paths);
  } catch (err) {
    console.error(`[AQB] 模板预加载失败：`, err);
    ui.notifications?.error?.("AQB 模板加载失败，请检查模块文件是否完整。详情见 F12。");
  }
}
