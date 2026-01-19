import { MODULE_ID, SETTINGS } from "./constants.js";
import { AqbConfigApp } from "./apps/config.js";

export function registerSettings() {
  game.settings.registerMenu(MODULE_ID, SETTINGS.CONFIG_MENU, {
    name: "AQB：配置",
    label: "打开",
    hint: "打开 AQB 的配置面板。",
    icon: "fas fa-cog",
    type: AqbConfigApp,
    restricted: false
  });

  game.settings.register(MODULE_ID, SETTINGS.LAST_TOKEN_UUID, {
    name: "AQB：上次绑定的 Token",
    hint: "AQB 会记住你上一次在面板中绑定的 Token，用于下次打开时自动选择。",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.SPELLS_SORT_MODE, {
    name: "AQB：法术排列方式",
    hint: "AQB 法术页的默认排列方式（按环位 / 按施法时间）。",
    scope: "client",
    config: false,
    type: String,
    default: "level"
  });

  game.settings.register(MODULE_ID, SETTINGS.SPELLS_UNPREPARED_MODE, {
    name: "AQB：未准备法术处理",
    hint: "AQB 法术页中未准备法术的显示/交互方式（按钮禁用 / 忽略 / 隐藏）。",
    scope: "client",
    config: false,
    type: String,
    default: "disable"
  });
}
