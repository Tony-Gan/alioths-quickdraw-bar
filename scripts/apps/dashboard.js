import { DASHBOARD_APP_ID, MODULE_ID, SETTINGS } from "../constants.js";
import { storeLastToken } from "../services/token-binding.js";
import { rollAbilityCheck, rollAbilitySave, rollSkillCheck, rollInitiativeCheck, rollDeathSave } from "../services/dnd5e-rolls.js";
import { useDnd5eItem, getItemName } from "../services/dnd5e-item-use.js";
import { warn, error } from "../utils/notify.js";
import { buildDashboardContext } from "../services/dashboard-context.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AqbDashboardApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: DASHBOARD_APP_ID,
    classes: ["aqb-app"],
    tag: "section",
    window: {
      icon: "fas fa-bolt",
      title: "Alioth's Quickdraw Bar",
      resizable: true
    },
    position: {
      width: Math.max(800, Math.floor(window.innerWidth / 2)),
      height: 300
    }
  }, { inplace: false });

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/dashboard.hbs`
    }
  };

  constructor(options = {}) {
    super(options);

    this._tokenId = null;
    this._activeTab = "checks"; 
    this._warnedNoToken = false;
    this._didAutoPosition = false;
    this._rerenderTimer = null;
    
    this._spellsUnpreparedMode = game.settings.get(MODULE_ID, SETTINGS.SPELLS_UNPREPARED_MODE) || "disable";
    this._itemsSortMode = "type-weapon";
    this._itemsHideMode = "hide";

    this._featuresPassiveMode = "show";
    this._featuresHiddenMode = "hide";

    this._handleUpdate = this._onUpdateAny.bind(this);
    
    Hooks.on("updateActor", this._handleUpdate);
    Hooks.on("updateToken", this._handleUpdate);

    Hooks.on("updateItem", this._handleUpdate);
    Hooks.on("createItem", this._handleUpdate);
    Hooks.on("deleteItem", this._handleUpdate);
  }

  /* -------------------------------------------- */
  /* 数据准备 */
  /* -------------------------------------------- */

  async _prepareContext(_options) {
    const context = await buildDashboardContext(
      this._tokenId,
      this._activeTab,
      this._spellsSortMode,
      this._spellsUnpreparedMode,
      this._itemsSortMode,
      this._itemsHideMode,
      this._featuresPassiveMode,
      this._featuresHiddenMode
    );


    if (context.finalTokenId !== this._tokenId) {
      this._tokenId = context.finalTokenId;
    }

    if (context.shouldWarnNoToken && !this._warnedNoToken) {
      warn("AQB：当前场景没有你拥有的 Token。请切换场景或放置 Token 后重试。");
      this._warnedNoToken = true;
    }

    return context;
  }

  /* -------------------------------------------- */
  /* 事件监听与渲染 */
  /* -------------------------------------------- */

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    if (!this._didAutoPosition) {
      this._applyDefaultBottomPosition();
      this._didAutoPosition = true;
    }
    this.element.addEventListener("click", (ev) => this._handleClick(ev));
    this.element.addEventListener("change", (ev) => this._handleChange(ev));
    this.element.addEventListener("contextmenu", (ev) => this._handleContextMenu(ev));

    this.element.addEventListener("wheel", (ev) => this._handleWheel(ev), { passive: false });
  }


  async _onRender(context, options) {
    await super._onRender(context, options);

    this._aqbItemContextMenu?.close({ animate: false }).catch?.(() => {});
    this._aqbItemContextMenu = new ContextMenu(this.element, ".aqb-item-btn", [
      {
        name: "重命名",
        icon: '<i class="fa-solid fa-pen-to-square"></i>',
        callback: (target) => {
          const el = target instanceof HTMLElement ? target : target?.[0];
          const key = el?.dataset?.aqbKey;
          const label = el?.querySelector?.(".aqb-item-main")?.textContent ?? "";
          if (key) this._handleRenameItem(key, label);
        }
      },
      {
        name: "刷新连接",
        icon: '<i class="fa-solid fa-rotate"></i>',
        callback: (target) => {
          const el = target instanceof HTMLElement ? target : target?.[0];
          const key = el?.dataset?.aqbKey;
          if (key) this._handleRefreshItemLabel(key);
        }
      }
    ]);

  }

  /* -------------------------------------------- */
  /* UI 交互 */
  /* -------------------------------------------- */

  _handleContextMenu(ev) {
    const target = ev.target;
    if (!target) return;

    if (target.closest?.(".aqb-item-btn")) return;

    const btn = target.closest?.("button[data-aqb-roll]");
    if (!btn) return;

    const roll = btn.dataset?.aqbRoll;
    const key = btn.dataset?.aqbKey;
    if (!roll || !key) return;

    if (roll === "status") {
      ev.preventDefault();
      ev.stopImmediatePropagation?.();
      ev.stopPropagation();
      this._handleStatusToggleOverlay(key);
      return;
    }

    if (roll === "extra-effect") {
      ev.preventDefault();
      ev.stopImmediatePropagation?.();
      ev.stopPropagation();
      this._handleExtraEffectDelete(key);
      return;
    }
  }


  _handleWheel(ev) {
    const scroller = this._findScrollableAncestor(ev.target);
    if (!scroller) return;

    scroller.scrollTop += ev.deltaY;
    scroller.scrollLeft += ev.deltaX;
    ev.preventDefault();
    ev.stopPropagation();
  }

  _findScrollableAncestor(startEl) {
    if (!this.element) return null;
    let el = startEl instanceof HTMLElement ? startEl : null;
    while (el && el !== this.element) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const canScrollY = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
      const canScrollX = (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth;
      if (canScrollY || canScrollX) return el;
      el = el.parentElement;
    }
    const fallback = this.element.querySelector?.(".aqb-spells-content");
    if (fallback && fallback.scrollHeight > fallback.clientHeight) return fallback;
    return null;
  }

  /* -------------------------------------------- */
  /* 集中式事件处理 (Handlers) */
  /* -------------------------------------------- */

  _handleClick(ev) {
    const target = ev.target;
    
    // Tab 切换
    const tabBtn = target.closest("button[data-aqb-tab]");
    if (tabBtn) {
      const tab = tabBtn.dataset.aqbTab;
      if (tab && tab !== this._activeTab) {
        this._activeTab = tab;
        this.render(false);
      }
      return;
    }

    // 掷骰/使用
    const rollBtn = target.closest("button[data-aqb-roll]");
    if (rollBtn) {
      ev.preventDefault(); 
      this._dispatchRoll(rollBtn.dataset.aqbRoll, rollBtn.dataset.aqbKey);
    }
  }

  _handleChange(ev) {
    const target = ev.target;

    // Token 选择
    if (target.matches("select[data-aqb-token-select]")) {
      this._tokenId = target.value || null;
      const token = this._getBoundToken();
      if (token) storeLastToken(token);
      this.render(false);
      return;
    }

    // 法术排序
    if (target.matches("select[data-aqb-spells-sort]")) {
      this._spellsSortMode = target.value || "level";
      game.settings.set(MODULE_ID, SETTINGS.SPELLS_SORT_MODE, this._spellsSortMode);
      this.render(false);
      return;
    }
  
    // 未准备法术处理
    if (target.matches("select[data-aqb-spells-unprepared]")) {
      this._spellsUnpreparedMode = target.value || "disable";
      game.settings.set(MODULE_ID, SETTINGS.SPELLS_UNPREPARED_MODE, this._spellsUnpreparedMode);
      this.render(false);
      return;
    }

    // 所持物排序
    if (target.matches("select[data-aqb-items-sort]")) {
      this._itemsSortMode = target.value || "type-weapon";
      this.render(false);
      return;
    }

    // 隐藏物品（暂不提供功能，仅保留状态）
    if (target.matches("select[data-aqb-items-hide]")) {
      this._itemsHideMode = target.value || "hide";
      this.render(false);
      return;
    }

    // 被动特性显示（保留状态；当前仅控制列表筛选）
    if (target.matches("select[data-aqb-features-passive]")) {
      this._featuresPassiveMode = target.value || "show";
      this.render(false);
      return;
    }

    // 隐藏特性（暂不提供功能，仅保留状态）
    if (target.matches("select[data-aqb-features-hidden]")) {
      this._featuresHiddenMode = target.value || "hide";
      this.render(false);
      return;
    }
  }

  /* -------------------------------------------- */
  /* 业务逻辑分发 (Dispatcher) */
  /* -------------------------------------------- */

  _dispatchRoll(action, key) {
    switch (action) {
      case "initiative": return this._handleInitiative();
      case "death-save": return this._handleDeathSave();
      case "status": return key ? this._handleStatusToggle(key) : null;
      case "movement-action": return key ? this._handleMovementAction(key) : null;
      case "extra-effect": return key ? this._handleExtraEffectToggle(key) : null;
      case "spell": return key ? this._handleSpellUse(key) : null;
      case "item": return key ? this._handleItemUse(key) : null;
      case "ability-check": return key ? this._handleAbilityCheck(key) : null;
      case "ability-save": return key ? this._handleAbilitySave(key) : null;
      case "skill": return key ? this._handleSkillCheck(key) : null;
      default: console.warn(`[AQB] 未知的操作类型: ${action}`);
    }
  }

  _getBoundToken() {
    if (!canvas?.tokens || !this._tokenId) return null;
    return canvas.tokens.placeables.find((t) => t.id === this._tokenId) ?? null;
  }

  _getBoundActor() {
    return this._getBoundToken()?.actor ?? null;
  }

  _onUpdateAny(doc) {
    const bound = this._getBoundActor();
    if (!bound) return;
    
    if ((doc.documentName === "Actor" && doc.id === bound.id) ||
        (doc.documentName === "Token" && doc.id === this._tokenId) ||
        (doc.documentName === "Item" && doc.parent?.id === bound.id)) {
      this._scheduleRerender();
    }

  }

  _scheduleRerender() {
    if (!this.element) return;
    if (this._rerenderTimer) window.clearTimeout(this._rerenderTimer);
    this._rerenderTimer = window.setTimeout(() => {
      this._rerenderTimer = null;
      this.render(false);
    }, 60);
  }

  /* -------------------------------------------- */
  /* 具体操作实现 */
  /* -------------------------------------------- */

  async _safeRun(actionName, callback) {
    const actor = this._getBoundActor();
    if (!actor) return warn("AQB：当前未绑定角色。请先绑定 Token。");
    try {
      await callback(actor);
    } catch (e) {
      console.error(`[AQB] ${actionName}失败`, e);
      error(`AQB：无法进行${actionName}。详情见 F12。`);
    }
  }

  async _handleRenameItem(itemId, currentLabel = null) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    const displayName = (typeof currentLabel === "string" && currentLabel.length) ? currentLabel : getItemName(item);
    const safeValue = foundry.utils.escapeHTML(displayName ?? "");

    new Dialog({
      title: "重命名按钮",
      content: `
        <form>
          <div class="form-group">
            <label>新名称：</label>
            <input type="text" name="alias" value="${safeValue}" style="width:100%" autofocus/> <!-- -->
          </div>
        </form>
      `,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: "确定",
          callback: async (html) => {
            const newValue = String(html.find('[name="alias"]').val() ?? "");
            if (newValue === "" || newValue === item.name) {
              await item.unsetFlag(MODULE_ID, "alias");
            } else {
              await item.setFlag(MODULE_ID, "alias", newValue);
            }
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "取消" }
      },
      default: "confirm"
    }).render(true);
  }

  async _handleRefreshItemLabel(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    await item.unsetFlag(MODULE_ID, "alias");
  }

  async _handleInitiative() { await this._safeRun("先攻检定", (actor) => rollInitiativeCheck(actor)); }
  async _handleDeathSave() { await this._safeRun("死亡豁免", (actor) => rollDeathSave(actor)); }
  async _handleSpellUse(itemId) { 
    await this._safeRun("施放法术", async (actor) => {
      const item = actor.items?.get?.(itemId);
      if (!item) return warn("AQB：未找到该法术。");
      await useDnd5eItem(item);
    });
  }
  async _handleItemUse(itemId) {
    await this._safeRun("使用物品", async (actor) => {
      const item = actor.items?.get?.(itemId);
      if (!item) return warn("AQB：未找到该物品。");
      await useDnd5eItem(item);
    });
  }
  async _handleAbilityCheck(id) { await this._safeRun("属性检定", (actor) => rollAbilityCheck(actor, id)); }
  async _handleAbilitySave(id) { await this._safeRun("属性豁免", (actor) => rollAbilitySave(actor, id)); }
  async _handleSkillCheck(id) { await this._safeRun("技能检定", (actor) => rollSkillCheck(actor, id)); }
  async _handleStatusToggle(statusId) {
    await this._safeRun("切换状态", async (actor) => {
      await actor.toggleStatusEffect(statusId);
    });
  }

  async _handleStatusToggleOverlay(statusId) {
    await this._safeRun("切换状态(覆盖)", async (actor) => {
      const tokenDoc = this._getBoundToken()?.document;
      const isActive = tokenDoc?.hasStatusEffect?.(statusId) ?? false;
      if (isActive) {
        await actor.toggleStatusEffect(statusId, { active: false });
        return;
      }
      await actor.toggleStatusEffect(statusId, { active: true, overlay: true });
    });
  }

  async _handleMovementAction(actionId) {
    await this._safeRun("切换移动方式", async (_actor) => {
      const tokenDoc = this._getBoundToken()?.document;
      if (!tokenDoc) return warn("AQB：当前未绑定 Token。请先绑定 Token。");

      const cfg = CONFIG?.Token?.movement?.actions?.[actionId];
      if (!cfg) return warn("AQB：未知的移动方式。");
      if (typeof cfg.canSelect === "function" && !cfg.canSelect(tokenDoc)) return warn("AQB：该移动方式当前不可用。");

      await tokenDoc.update({ movementAction: actionId });
    });
  }

  async _handleExtraEffectToggle(effectId) {
    await this._safeRun("切换效应", async (actor) => {
      const effect = actor.effects?.get?.(effectId);
      if (!effect) return warn("AQB：未找到该效应。");
      await effect.update({ disabled: !Boolean(effect.disabled) });
    });
  }

  async _handleExtraEffectDelete(effectId) {
    await this._safeRun("删除效应", async (actor) => {
      const effect = actor.effects?.get?.(effectId);
      if (!effect) return;
      await effect.delete();
    });
  }

  /* -------------------------------------------- */
  /* 生命周期 */
  /* -------------------------------------------- */

  get title() {
    const token = this._getBoundToken();
    const name = token?.name ? `：${token.name}` : "";
    return `Alioth's Quickdraw Bar${name}`;
  }

  _applyDefaultBottomPosition() {
    const desiredWidth = Math.max(800, Math.floor(window.innerWidth / 2));
    const padding = 10;
    const width = Math.min(desiredWidth, window.innerWidth - padding * 2);
    const defaultHeight = (typeof this.position?.height === "number") ? this.position.height : 300;
    const height = Math.min(defaultHeight, window.innerHeight - padding * 2); 
    const left = Math.max(padding, Math.floor((window.innerWidth - width) / 2));
    const top = Math.max(padding, Math.floor(window.innerHeight - height));
    this.setPosition({ left, top, width, height });
  }

  _onClose(options) {
    super._onClose(options);
    Hooks.off("updateActor", this._handleUpdate);
    Hooks.off("updateToken", this._handleUpdate);
    Hooks.off("updateItem", this._handleUpdate);
    Hooks.off("createItem", this._handleUpdate);
    Hooks.off("deleteItem", this._handleUpdate);
    if (this._rerenderTimer) window.clearTimeout(this._rerenderTimer);
    ui.controls?.render();
  }
}