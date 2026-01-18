import { DASHBOARD_APP_ID, MODULE_ID, SETTINGS, FEATURE_AUTO_HIDE_NAME_MAP } from "../constants.js";
import { storeLastToken } from "../services/token-binding.js";
import { rollAbilityCheck, rollAbilitySave, rollSkillCheck, rollInitiativeCheck, rollDeathSave, rollAbilityCheckFast, rollAbilitySaveFast, rollSkillCheckFast, rollInitiativeCheckFast } from "../services/dnd5e-rolls.js";
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
      width: Math.max(1010, Math.floor(window.innerWidth / 2)),
      height: 270
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
    this._itemPopoverEl = null;
    this._itemPopoverDismissHandler = null;
    this._itemPopoverEscHandler = null;
    this._splitRollPopoverEl = null;
    this._splitRollPopoverDismissHandler = null;
    this._splitRollPopoverEscHandler = null;

    this._itemHoverEl = null;
    this._itemHoverTimer = null;
    this._itemHoverBtn = null;
    this._itemHoverPos = { x: 0, y: 0 };

    this._sortState = null;
    this._suppressNextClick = false;

    this._controlTokenDebounce = null;
    
    this._spellsUnpreparedMode = game.settings.get(MODULE_ID, SETTINGS.SPELLS_UNPREPARED_MODE) || "disable";
    this._spellsHideMode = "hide";
    this._itemsSortMode = "time";
    this._itemsHideMode = "hide";

    this._featuresHiddenMode = "hide";
    this._featuresSortMode = "time";

    this._handleUpdate = this._onUpdateAny.bind(this);
    this._handleControlToken = this._onControlToken.bind(this);
    
    Hooks.on("updateActor", this._handleUpdate);
    Hooks.on("updateToken", this._handleUpdate);

    Hooks.on("createActiveEffect", this._handleUpdate);
    Hooks.on("updateActiveEffect", this._handleUpdate);
    Hooks.on("deleteActiveEffect", this._handleUpdate);

    Hooks.on("updateItem", this._handleUpdate);
    Hooks.on("createItem", this._handleUpdate);
    Hooks.on("deleteItem", this._handleUpdate);

    Hooks.on("controlToken", this._handleControlToken);
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
      this._spellsHideMode,
      this._itemsSortMode,
      this._itemsHideMode,
      this._featuresHiddenMode,
      this._featuresSortMode
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

    this.element.addEventListener("mousemove", (ev) => this._handleMouseMove(ev));
    this.element.addEventListener("mouseover", (ev) => this._handleMouseOver(ev));
    this.element.addEventListener("mouseout", (ev) => this._handleMouseOut(ev));

    this.element.addEventListener("pointerdown", (ev) => this._handleSortPointerDown(ev), { passive: false });
    this.element.addEventListener("wheel", (ev) => this._handleWheel(ev), { passive: false });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this._closeItemPopover();
    this._closeSplitRollPopover();
    if (this._itemHoverTimer) window.clearTimeout(this._itemHoverTimer);
    this._itemHoverTimer = null;
    this._itemHoverBtn = null;
    this._closeItemHoverCard();
  }

  _handleMouseMove(ev) {
    if (!ev) return;
    this._itemHoverPos = { x: ev.clientX ?? 0, y: ev.clientY ?? 0 };
  }

  _handleMouseOver(ev) {
    if (this._sortState?.dragging) return;
    const btn = ev?.target?.closest?.(".aqb-sort-item[data-aqb-key]");
    if (!(btn instanceof HTMLElement)) return;
    if (this._itemHoverBtn === btn) return;
    this._itemHoverBtn = btn;

    if (this._itemHoverTimer) window.clearTimeout(this._itemHoverTimer);
    this._itemHoverTimer = window.setTimeout(() => {
      this._itemHoverTimer = null;
      this._openItemHoverCard(btn);
    }, 1000);
  }

  _handleMouseOut(ev) {
    const fromBtn = ev?.target?.closest?.(".aqb-sort-item[data-aqb-key]");
    if (!(fromBtn instanceof HTMLElement)) return;
    if (this._itemHoverBtn !== fromBtn) return;
    const to = ev?.relatedTarget;
    if (to instanceof Node && fromBtn.contains(to)) return;
    if (to instanceof Node && to.closest?.(".aqb-sort-item[data-aqb-key]") === fromBtn) return;

    if (this._itemHoverTimer) window.clearTimeout(this._itemHoverTimer);
    this._itemHoverTimer = null;
    this._itemHoverBtn = null;
    this._closeItemHoverCard();
  }

  _closeItemHoverCard() {
    if (this._itemHoverEl) this._itemHoverEl.remove();
    this._itemHoverEl = null;
  }

  _openItemHoverCard(anchorBtn) {
    const btn = anchorBtn instanceof HTMLElement ? anchorBtn : null;
    const itemId = btn?.dataset?.aqbKey;
    if (!btn || !itemId) return;

    const actor = this._getBoundActor();
    const item = actor?.items?.get?.(itemId) ?? null;
    if (!item) return;

    const name = getItemName(item) ?? item.name ?? "";
    const type = String(item?.labels?.type ?? item?.system?.type?.label ?? item?.system?.type?.value ?? item?.type ?? "");
    const uses = item?.system?.uses ?? {};
    const max = Number(uses?.max ?? 0);
    const value = Number(uses?.value ?? 0);
    const usesText = (Number.isFinite(max) && max > 0) ? `${Number.isFinite(value) ? value : 0}/${max}` : "";

    const descHtml = item?.system?.description?.value ?? item?.system?.description ?? "";
    const desc = this._stripHtmlToText(descHtml).trim();
    const descShort = desc.length > 360 ? `${desc.slice(0, 360)}…` : desc;

    if (!this._itemHoverEl) {
      this._itemHoverEl = document.createElement("div");
      this._itemHoverEl.classList.add("aqb-item-hovercard");
      document.body.appendChild(this._itemHoverEl);
    }

    const esc = foundry.utils.escapeHTML;
    const icon = String(item?.img ?? "");
    const requirements = String(item?.labels?.requirements ?? item?.system?.requirements ?? "").trim();

    const tags = [];
    const equipped = item?.system?.equipped;
    if (equipped === false) tags.push("NOT EQUIPPED");
    const proficient = item?.system?.proficient;
    if (proficient === false) tags.push("NOT PROFICIENT");

    const metaParts = [type, usesText].filter((s) => Boolean(s));
    const reqHtml = requirements ? `<div class="aqb-item-hovercard-req"><span class="aqb-item-hovercard-req-label">使用要求：</span>${esc(requirements)}</div>` : "";
    const tagsHtml = tags.length ? `<div class="aqb-item-hovercard-tags">${tags.map((t) => `<span class="aqb-item-hovercard-tag">${esc(t)}</span>`).join("")}</div>` : "";
    this._itemHoverEl.innerHTML = `
      <div class="aqb-item-hovercard-head">
        ${icon ? `<img class="aqb-item-hovercard-icon" src="${esc(icon)}" alt="" />` : ""}
        <div class="aqb-item-hovercard-head-text">
          <div class="aqb-item-hovercard-title">${esc(String(name))}</div>
          ${metaParts.length ? `<div class="aqb-item-hovercard-meta">${esc(metaParts.join(" · "))}</div>` : ""}
        </div>
      </div>
      ${reqHtml}
      ${descShort ? `<div class="aqb-item-hovercard-desc">${esc(descShort)}</div>` : ""}
      ${tagsHtml}
    `;

    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = this._itemHoverEl.getBoundingClientRect();
    const pw = rect.width;
    const ph = rect.height;

    let left = (this._itemHoverPos?.x ?? 0) + 14;
    let top = (this._itemHoverPos?.y ?? 0) + 14;
    if (left + pw + margin > vw) left = Math.max(margin, vw - pw - margin);
    if (top + ph + margin > vh) top = Math.max(margin, (this._itemHoverPos?.y ?? 0) - ph - 14);

    this._itemHoverEl.style.left = `${Math.round(left)}px`;
    this._itemHoverEl.style.top = `${Math.round(top)}px`;
  }

  _stripHtmlToText(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = String(html);
    return div.textContent ?? "";
  }

  /* -------------------------------------------- */
  /* UI 交互 */
  /* -------------------------------------------- */

  _handleContextMenu(ev) {
    if (this._sortState?.dragging) return;
    const target = ev.target;
    if (!target) return;

    const splitBtn = target.closest?.("button.aqb-split2-btn[data-aqb-roll]");
    if (splitBtn) {
      if (splitBtn?.disabled) return;
      const roll = splitBtn.dataset?.aqbRoll;
      const key = splitBtn.dataset?.aqbKey || null;
      const excluded = ["hit-dice", "short-rest", "long-rest"].includes(String(roll ?? ""));
      const fastCapable = ["initiative", "ability-check", "ability-save", "skill"].includes(String(roll ?? ""));
      if (fastCapable && !excluded) {
        ev.preventDefault();
        ev.stopImmediatePropagation?.();
        ev.stopPropagation();
        this._openSplitRollPopover(splitBtn);
        return;
      }
    }

    const btn = target.closest?.("[data-aqb-roll][data-aqb-key]");
    if (!btn) return;

    const roll = btn.dataset?.aqbRoll;
    const key = btn.dataset?.aqbKey || null;
    if (!roll) return;
    if (!key) return;
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

    if (roll === "item" || roll === "spell") {
      ev.preventDefault();
      ev.stopImmediatePropagation?.();
      ev.stopPropagation();
      this._openItemPopover(btn);
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

  _handleSortPointerDown(ev) {
    if (!ev || ev.button !== 0) return;
    const t = ev.target;
    if (!(t instanceof Node)) return;
    const itemEl = t.closest?.(".aqb-sort-item[data-aqb-sort-key][data-aqb-sort-section]");
    if (!(itemEl instanceof HTMLElement)) return;
    const container = itemEl.closest?.("[data-aqb-sort-container]");
    if (!(container instanceof HTMLElement)) return;
    const containerKey = String(container.dataset?.aqbSortContainer ?? "");
    const sectionKey = String(itemEl.dataset?.aqbSortSection ?? "");
    if (!containerKey || !sectionKey || containerKey !== sectionKey) return;
    if (this._sortState?.active) return;

    this._sortState = {
      active: true,
      dragging: false,
      pointerId: ev.pointerId,
      startX: ev.clientX ?? 0,
      startY: ev.clientY ?? 0,
      offsetX: 0,
      offsetY: 0,
      container,
      containerKey,
      itemEl,
      placeholder: null
    };

    try { itemEl.setPointerCapture(ev.pointerId); } catch (_) {}

    const move = (e) => this._handleSortPointerMove(e);
    const up = (e) => this._handleSortPointerUp(e);
    this._sortState._move = move;
    this._sortState._up = up;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up, { passive: false });
  }

  _handleSortPointerMove(ev) {
    const st = this._sortState;
    if (!st?.active) return;
    if (ev.pointerId !== st.pointerId) return;

    const x = ev.clientX ?? 0;
    const y = ev.clientY ?? 0;
    const dx = x - st.startX;
    const dy = y - st.startY;

    if (!st.dragging) {
      if ((dx * dx + dy * dy) < 36) return;
      this._startSortDrag(ev);
    }

    ev.preventDefault();
    this._moveSortDrag(ev);
  }

  _handleSortPointerUp(ev) {
    const st = this._sortState;
    if (!st?.active) return;
    if (ev.pointerId !== st.pointerId) return;

    window.removeEventListener("pointermove", st._move, { passive: false });
    window.removeEventListener("pointerup", st._up, { passive: false });

    if (!st.dragging) {
      this._sortState = null;
      return;
    }

    this._finishSortDrag();
  }

  _startSortDrag(ev) {
    const st = this._sortState;
    if (!st?.active || st.dragging) return;
    const el = st.itemEl;
    const rect = el.getBoundingClientRect();
    st.dragging = true;
    st.offsetX = (ev.clientX ?? rect.left) - rect.left;
    st.offsetY = (ev.clientY ?? rect.top) - rect.top;

    this._closeItemPopover();
    if (this._itemHoverTimer) window.clearTimeout(this._itemHoverTimer);
    this._itemHoverTimer = null;
    this._itemHoverBtn = null;
    this._closeItemHoverCard();

    const ph = document.createElement("div");
    ph.classList.add("aqb-sort-placeholder");
    ph.style.width = `${Math.round(rect.width)}px`;
    ph.style.height = `${Math.round(rect.height)}px`;
    st.placeholder = ph;
    st.container.insertBefore(ph, el.nextSibling);

    this.element.appendChild(el);
    el.classList.add("aqb-sort-dragging");
    el.style.left = `${Math.round(rect.left)}px`;
    el.style.top = `${Math.round(rect.top)}px`;
    el.style.width = `${Math.round(rect.width)}px`;
    el.style.height = `${Math.round(rect.height)}px`;
  }

  _moveSortDrag(ev) {
    const st = this._sortState;
    if (!st?.dragging) return;
    const el = st.itemEl;
    const x = (ev.clientX ?? 0) - st.offsetX;
    const y = (ev.clientY ?? 0) - st.offsetY;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;

    this._repositionSortPlaceholder(ev.clientX ?? 0, ev.clientY ?? 0);
  }

  _repositionSortPlaceholder(px, py) {
    const st = this._sortState;
    if (!st?.dragging) return;
    const container = st.container;
    const ph = st.placeholder;
    if (!container || !ph) return;

    const items = Array.from(container.querySelectorAll(".aqb-sort-item"));
    if (!items.length) return;

    const rects = items.map((el) => ({ el, r: el.getBoundingClientRect() }))
      .sort((a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left));

    const rows = [];
    const tol = 8;
    for (const it of rects) {
      const row = rows[rows.length - 1];
      if (!row || Math.abs(it.r.top - row.top) > tol) {
        rows.push({ top: it.r.top, items: [it] });
      } else {
        row.items.push(it);
      }
    }

    let bestRow = rows[0];
    let bestDist = Infinity;
    for (const row of rows) {
      const ys = row.items.map((x) => x.r.top + x.r.height / 2);
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
      const d = Math.abs(py - cy);
      if (d < bestDist) { bestDist = d; bestRow = row; }
    }

    const rowItems = bestRow.items.slice().sort((a, b) => a.r.left - b.r.left);
    let beforeEl = null;
    for (const it of rowItems) {
      const mid = it.r.left + it.r.width / 2;
      if (px < mid) { beforeEl = it.el; break; }
    }
    if (!beforeEl) {
      const last = rowItems[rowItems.length - 1];
      const idx = rects.findIndex((x) => x.el === last.el);
      beforeEl = rects[idx + 1]?.el ?? null;
    }

    const old = new Map(rects.map((x) => [x.el, x.r]));
    if (beforeEl) container.insertBefore(ph, beforeEl); else container.appendChild(ph);
    this._animateSortReflow(container, old);
  }

  _animateSortReflow(container, oldRects) {
    const els = Array.from(container.querySelectorAll(".aqb-sort-item"));
    for (const el of els) {
      const old = oldRects.get(el);
      if (!old) continue;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }
      );
    }
  }

  async _saveSortOrder(sortKey, ids) {
    const actor = this._getBoundActor();
    if (!actor || !actor.isOwner) return;
    const current = actor?.getFlag?.(MODULE_ID, "sortOrders") ?? actor?.flags?.[MODULE_ID]?.sortOrders ?? {};
    const next = { ...(current ?? {}) };
    next[sortKey] = Array.isArray(ids) ? ids : [];
    await actor.setFlag(MODULE_ID, "sortOrders", next);
  }

  _finishSortDrag() {
    const st = this._sortState;
    if (!st?.dragging) { this._sortState = null; return; }
    const el = st.itemEl;
    const ph = st.placeholder;
    const container = st.container;
    const key = st.containerKey;

    el.classList.remove("aqb-sort-dragging");
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";

    container.insertBefore(el, ph);
    ph.remove();

    const ids = Array.from(container.querySelectorAll(".aqb-sort-item"))
      .map((x) => String(x.dataset?.aqbSortKey ?? ""))
      .filter((s) => Boolean(s));
    void this._saveSortOrder(key, ids);

    this._sortState = null;
    this._suppressNextClick = true;
    window.setTimeout(() => { this._suppressNextClick = false; }, 50);
  }


  _closeSplitRollPopover() {
    const pop = this._splitRollPopoverEl;
    if (pop) {
      pop.classList.remove("is-open");
      pop.classList.add("is-closing");
      window.setTimeout(() => pop.remove(), 220);
    }
    this._splitRollPopoverEl = null;
    if (this._splitRollPopoverDismissHandler) document.removeEventListener("mousedown", this._splitRollPopoverDismissHandler, true);
    if (this._splitRollPopoverEscHandler) document.removeEventListener("keydown", this._splitRollPopoverEscHandler, true);
    this._splitRollPopoverDismissHandler = null;
    this._splitRollPopoverEscHandler = null;
  }

  _openSplitRollPopover(anchorBtn) {
    const btn = anchorBtn instanceof HTMLElement ? anchorBtn : null;
    const roll = btn?.dataset?.aqbRoll;
    const key = btn?.dataset?.aqbKey || null;
    if (!btn || !roll) return;

    const excluded = ["hit-dice", "short-rest", "long-rest"].includes(String(roll ?? ""));
    const fastCapable = ["initiative", "ability-check", "ability-save", "skill"].includes(String(roll ?? ""));
    if (excluded || !fastCapable) return;

    this._closeItemPopover();
    this._closeSplitRollPopover();

    const pop = document.createElement("div");
    pop.classList.add("aqb-item-popover");
    pop.dataset.aqbRoll = roll;
    pop.dataset.aqbKey = key ?? "";

    pop.innerHTML = `
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-roll-mode="normal">直接掷骰</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-roll-mode="advantage">优势掷骰</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-roll-mode="disadvantage">劣势掷骰</button>
    `;

    pop.style.visibility = "hidden";
    document.body.appendChild(pop);

    const rect = btn.getBoundingClientRect();
    const margin = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;

    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + pw + margin > vw) left = Math.max(margin, vw - pw - margin);
    if (top + ph + margin > vh) top = Math.max(margin, rect.top - ph - margin);

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.style.visibility = "";
    requestAnimationFrame(() => pop.classList.add("is-open"));

    pop.addEventListener("click", async (ev) => {
      const modeBtn = ev.target?.closest?.("button[data-aqb-roll-mode]");
      const rollMode = modeBtn?.dataset?.aqbRollMode;
      if (!rollMode) return;
      if (modeBtn?.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      this._closeSplitRollPopover();
      await this._dispatchRollFast(roll, key, rollMode);
    });

    this._splitRollPopoverDismissHandler = (ev) => {
      const t = ev?.target;
      if (!(t instanceof Node)) return;
      if (pop.contains(t) || btn.contains(t)) return;
      this._closeSplitRollPopover();
    };
    document.addEventListener("mousedown", this._splitRollPopoverDismissHandler, true);

    this._splitRollPopoverEscHandler = (ev) => {
      if (ev?.key === "Escape") this._closeSplitRollPopover();
    };
    document.addEventListener("keydown", this._splitRollPopoverEscHandler, true);

    this._splitRollPopoverEl = pop;
  }

  _closeItemPopover() {
    const pop = this._itemPopoverEl;
    if (pop) {
      pop.classList.remove("is-open");
      pop.classList.add("is-closing");
      window.setTimeout(() => pop.remove(), 220);
    }
    this._itemPopoverEl = null;
    if (this._itemPopoverDismissHandler) document.removeEventListener("mousedown", this._itemPopoverDismissHandler, true);
    if (this._itemPopoverEscHandler) document.removeEventListener("keydown", this._itemPopoverEscHandler, true);
    this._itemPopoverDismissHandler = null;
    this._itemPopoverEscHandler = null;
  }

  _openItemPopover(anchorBtn) {
    const btn = anchorBtn instanceof HTMLElement ? anchorBtn : null;
    const key = btn?.dataset?.aqbKey;
    const roll = btn?.dataset?.aqbRoll;
    if (!btn || !key || !roll) return;

    this._closeItemPopover();
    this._closeSplitRollPopover();

    const label = btn.querySelector?.(".aqb-item-main")?.textContent ?? "";
    const pop = document.createElement("div");
    pop.classList.add("aqb-item-popover");
    pop.dataset.aqbKey = key;
    pop.dataset.aqbRoll = roll;

    const actor = this._getBoundActor();
    const item = actor?.items?.get?.(key) ?? null;

    const getFirstActivity = (it) => {
      const activities = it?.activities ?? it?.system?.activities;
      if (!activities) return null;
      if (Array.isArray(activities)) return activities[0] ?? null;
      if (Array.isArray(activities?.contents)) return activities.contents[0] ?? null;
      if (typeof activities?.values === "function") {
        const iter = activities.values();
        return iter?.next?.().value ?? null;
      }
      if (typeof activities === "object") {
        const list = Object.values(activities).filter(Boolean);
        if (!list.length) return null;
        const getSort = (a) => a?.sort ?? a?.order ?? a?.system?.sort ?? a?.system?.order;
        if (list.every((a) => Number.isFinite(Number(getSort(a))))) {
          list.sort((a, b) => Number(getSort(a)) - Number(getSort(b)));
        }
        return list[0] ?? null;
      }
      return null;
    };

    const hiddenFlag = Boolean(item?.getFlag?.(MODULE_ID, "hidden") ?? item?.flags?.[MODULE_ID]?.hidden);
    const forceShown = Boolean(item?.getFlag?.(MODULE_ID, "forceShow") ?? item?.flags?.[MODULE_ID]?.forceShow);

    const autoHiddenByNoActivity = (roll !== "spell") && !getFirstActivity(item);
    const autoHiddenByName = (roll !== "spell") && (this._activeTab === "features") && FEATURE_AUTO_HIDE_NAME_MAP.has(getItemName(item) ?? item?.name ?? "");
    const autoHidden = autoHiddenByNoActivity || autoHiddenByName;

    const isHidden = hiddenFlag || (autoHidden && !forceShown);
    const isFavorited = Boolean(item?.getFlag?.(MODULE_ID, "favorited") ?? item?.flags?.[MODULE_ID]?.favorited);

    const hideMode = (roll === "spell") ? this._spellsHideMode : (this._activeTab === "features" ? this._featuresHiddenMode : this._itemsHideMode);
    const canUnhide = hideMode === "disable" && isHidden;
    const hideAction = canUnhide ? "show" : "hide";
    const hideLabel = canUnhide ? "显示" : "隐藏";
    const favAction = isFavorited ? "unfavorite" : "favorite";
    const favLabel = isFavorited ? "取消收藏" : "收藏";
    const favDisabled = !isFavorited && isHidden;
    const hideDisabled = !canUnhide && isFavorited;

    pop.innerHTML = `
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="rename">重命名</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="reset">重置</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="${favAction}" ${favDisabled ? "disabled" : ""}>${favLabel}</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="${hideAction}" ${hideDisabled ? "disabled" : ""}>${hideLabel}</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="view">显示详情</button>
      <button type="button" class="aqb-btn aqb-item-popover-btn" data-aqb-action="chat">发送到聊天</button>
    `;

    pop.style.visibility = "hidden";
    document.body.appendChild(pop);

    const rect = btn.getBoundingClientRect();
    const margin = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;

    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + pw + margin > vw) left = Math.max(margin, vw - pw - margin);
    if (top + ph + margin > vh) top = Math.max(margin, rect.top - ph - margin);

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.style.visibility = "";
    requestAnimationFrame(() => pop.classList.add("is-open"));

    pop.addEventListener("click", async (ev) => {
      const actionBtn = ev.target?.closest?.("button[data-aqb-action]");
      const action = actionBtn?.dataset?.aqbAction;
      if (!action) return;
      if (actionBtn?.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      await this._handleItemPopoverAction(action, key, label);
      this._closeItemPopover();
    });

    this._itemPopoverDismissHandler = (ev) => {
      const t = ev?.target;
      if (!(t instanceof Node)) return;
      if (pop.contains(t) || btn.contains(t)) return;
      this._closeItemPopover();
    };
    document.addEventListener("mousedown", this._itemPopoverDismissHandler, true);

    this._itemPopoverEscHandler = (ev) => {
      if (ev?.key === "Escape") this._closeItemPopover();
    };
    document.addEventListener("keydown", this._itemPopoverEscHandler, true);

    this._itemPopoverEl = pop;
  }

  async _handleItemPopoverAction(action, itemId, currentLabel = "") {
    switch (action) {
      case "rename": return this._handleRenameItem(itemId, currentLabel);
      case "reset": return this._handleRefreshItemLabel(itemId);
      case "favorite": return this._handleFavoriteItem(itemId);
      case "unfavorite": return this._handleUnfavoriteItem(itemId);
      case "hide": return this._handleMarkItemHidden(itemId);
      case "show": return this._handleUnhideItem(itemId);
      case "view": return this._handleViewItem(itemId);
      case "chat": return this._handleDisplayItemInChat(itemId);
      default: return null;
    }
  }

  /* -------------------------------------------- */
  /* 集中式事件处理 */
  /* -------------------------------------------- */

  _handleClick(ev) {
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (this._sortState?.dragging) return;

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
    const rollBtn = target.closest("[data-aqb-roll]");
    if (rollBtn) {
      const realBtn = rollBtn.matches("button") ? rollBtn : (rollBtn.querySelector?.("button") ?? null);
      if (realBtn?.disabled) return;

      ev.preventDefault();
      const action = rollBtn.dataset?.aqbRoll;
      const key = rollBtn.dataset?.aqbKey;
      return this._dispatchRoll(action, key);
    }
  }

  _handleChange(ev) {
    const target = ev.target;

    // Token 选择
    if (target.matches("select[data-aqb-token-select]")) {
      this._tokenId = target.value || null;
      const token = this._getBoundToken();
      if (token) {
        storeLastToken(token);
      }
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

    // 隐藏法术
    if (target.matches("select[data-aqb-spells-hide]")) {
      this._spellsHideMode = target.value || "hide";
      this.render(false);
      return;
    }

    // 所持物排序
    if (target.matches("select[data-aqb-items-sort]")) {
      this._itemsSortMode = target.value || "time";
      this.render(false);
      return;
    }

    // 隐藏物品
    if (target.matches("select[data-aqb-items-hide]")) {
      this._itemsHideMode = target.value || "hide";
      this.render(false);
      return;
    }

    // 被动特性显示
    if (target.matches("select[data-aqb-features-passive]")) {
      this._featuresPassiveMode = target.value || "show";
      this.render(false);
      return;
    }

    // 特性排序（按类型 / 按释放时间）
    if (target.matches("select[data-aqb-features-sort]")) {
      this._featuresSortMode = target.value || "time";
      this.render(false);
      return;
    }

    // 隐藏特性
    if (target.matches("select[data-aqb-features-hidden]")) {
      this._featuresHiddenMode = target.value || "hide";
      this.render(false);
      return;
    }
  }

  /* -------------------------------------------- */
  /* 业务逻辑分发 */
  /* -------------------------------------------- */

  _dispatchRoll(action, key) {
    switch (action) {
      case "initiative": return this._handleInitiative();
      case "death-save": return this._handleDeathSave();
      case "hit-dice": return this._handleHitDice();
      case "short-rest": return this._handleShortRest();
      case "long-rest": return this._handleLongRest();
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

  _dispatchRollFast(action, key, rollMode = "normal") {
    switch (action) {
      case "initiative": return this._handleInitiativeFast(rollMode);
      case "ability-check": return key ? this._handleAbilityCheckFast(key, rollMode) : null;
      case "ability-save": return key ? this._handleAbilitySaveFast(key, rollMode) : null;
      case "skill": return key ? this._handleSkillCheckFast(key, rollMode) : null;
      default: return this._dispatchRoll(action, key);
    }
  }

  _getBoundToken() {
    if (!canvas?.tokens || !this._tokenId) return null;
    return canvas.tokens.placeables.find((t) => t.id === this._tokenId) ?? null;
  }

  _getBoundActor() {
    return this._getBoundToken()?.actor ?? null;
  }

  _onControlToken(token, controlled) {
    if (!controlled) return;
    if (!token?.id) return;

    if (this._controlTokenDebounce) window.clearTimeout(this._controlTokenDebounce);
    this._controlTokenDebounce = window.setTimeout(() => {
      this._controlTokenDebounce = null;

      const controlledTokens = canvas?.tokens?.controlled ?? [];
      if (controlledTokens.length !== 1) return;

      const onlyToken = controlledTokens[0];
      if (!onlyToken?.id) return;

      const actorId = onlyToken?.document?.actorId;
      const linkedActor = actorId ? game.actors?.get(actorId) : null;
      if (!linkedActor?.isOwner) return;

      if (onlyToken.id === this._tokenId) return;

      this._tokenId = onlyToken.id;
      storeLastToken(onlyToken);
      this.render(false);
    }, 0);
  }

  _onUpdateAny(...args) {
    let doc = args?.[0];
    if (doc?.documentName === "Scene" && args?.[1]?.documentName === "Token") doc = args[1];

    if (doc?.documentName === "ActiveEffect") {
      const bound = this._getBoundActor();
      if (!bound) return;
      const parentActor = (doc.parent?.documentName === "Actor") ? doc.parent : (doc.parent?.parent?.documentName === "Actor" ? doc.parent.parent : null);
      if (parentActor?.id === bound.id) this._scheduleRerender();
      return;
    }

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

  async _handleMarkItemHidden(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    const isFavorited = Boolean(item?.getFlag?.(MODULE_ID, "favorited") ?? item?.flags?.[MODULE_ID]?.favorited);
    if (isFavorited) return warn("AQB：已收藏的按钮无法隐藏，请先取消收藏。");
    await item.unsetFlag(MODULE_ID, "forceShow");
    await item.setFlag(MODULE_ID, "hidden", true);
  }

  async _handleUnhideItem(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    await item.unsetFlag(MODULE_ID, "hidden");
    await item.setFlag(MODULE_ID, "forceShow", true);
  }

  async _handleFavoriteItem(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    const isHidden = Boolean(item?.getFlag?.(MODULE_ID, "hidden") ?? item?.flags?.[MODULE_ID]?.hidden);
    if (isHidden) return warn("AQB：已隐藏的按钮无法收藏，请先显示。");
    await item.setFlag(MODULE_ID, "favorited", true);
  }

  async _handleUnfavoriteItem(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    await item.unsetFlag(MODULE_ID, "favorited");
  }

  async _handleViewItem(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    item.sheet?.render?.(true);
  }

  async _handleDisplayItemInChat(itemId) {
    const actor = this._getBoundActor();
    if (!actor) return;
    const item = actor.items.get(itemId);
    if (!item) return warn("AQB：未找到该物品。");
    if (typeof item.displayCard === "function") return item.displayCard();
    if (typeof item.toChat === "function") return item.toChat();
    return warn("AQB：当前系统不支持发送到聊天。");
  }

  async _handleInitiative() {
    await this._safeRun("先攻检定", async (actor) => {
      const combat = game.combat ?? null;
      if (!combat) return warn("AQB：当前没有进行中的战斗，无法投掷先攻。请先创建/开始战斗并将角色加入战斗。");

      const token = this._getBoundToken();
      const tokenId = token?.id ?? null;
      const combatant = token?.combatant
        ?? (tokenId ? combat.combatants?.find((c) => c?.tokenId === tokenId) : null)
        ?? combat.combatants?.find((c) => c?.actorId === actor.id);
      if (!combatant) return warn("AQB：该角色尚未加入当前战斗，无法投掷先攻。请先将其加入战斗。");

      return rollInitiativeCheck(actor);
    });
  }

  async _handleInitiativeFast(rollMode) {
    await this._safeRun("先攻检定", async (actor) => {
      const combat = game.combat ?? null;
      if (!combat) return warn("AQB：当前没有进行中的战斗，无法投掷先攻。请先创建/开始战斗并将角色加入战斗。");

      const token = this._getBoundToken();
      const tokenId = token?.id ?? null;
      const combatant = token?.combatant
        ?? (tokenId ? combat.combatants?.find((c) => c?.tokenId === tokenId) : null)
        ?? combat.combatants?.find((c) => c?.actorId === actor.id);
      if (!combatant) return warn("AQB：该角色尚未加入当前战斗，无法投掷先攻。请先将其加入战斗。");

      return rollInitiativeCheckFast(actor, rollMode);
    });
  }

  async _handleDeathSave() {
    await this._safeRun("死亡豁免", (actor) => {
      const hp = Number(actor?.system?.attributes?.hp?.value ?? NaN);
      const death = actor?.system?.attributes?.death ?? {};
      const success = Number(death?.success ?? 0);
      const failure = Number(death?.failure ?? 0);
      if (!Number.isFinite(hp)) return warn("AQB：无法读取生命值，不能进行死亡豁免。");
      if (hp > 0) return warn("AQB：当前生命值大于 0，不能进行死亡豁免。");
      if (success >= 3 || failure >= 3) return warn("AQB：死亡豁免已结束（成功或失败已达 3 次），不能继续投掷。");
      return rollDeathSave(actor);
    });
  }

  async _handleHitDice() {
    await this._safeRun("生命骰", async (actor) => {
      if (typeof actor.rollHitDie !== "function") return warn("AQB：当前系统不支持生命骰掷骰。");
      try {
        await actor.rollHitDie({ dialog: true });
      } catch (_e) {
        await actor.rollHitDie(undefined, { dialog: true });
      }
    });
  }

  async _handleShortRest() {
    await this._safeRun("短休", async (actor) => {
      if (typeof actor.shortRest !== "function") return warn("AQB：当前系统不支持短休。");
      try {
        await actor.shortRest({ dialog: true });
      } catch (_e) {
        await actor.shortRest();
      }
    });
  }

  async _handleLongRest() {
    await this._safeRun("长休", async (actor) => {
      if (typeof actor.longRest !== "function") return warn("AQB：当前系统不支持长休。");
      try {
        await actor.longRest({ dialog: true });
      } catch (_e) {
        await actor.longRest();
      }
    });
  }

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
  async _handleAbilityCheckFast(id, rollMode) { await this._safeRun("属性检定", (actor) => rollAbilityCheckFast(actor, id, rollMode)); }
  async _handleAbilitySaveFast(id, rollMode) { await this._safeRun("属性豁免", (actor) => rollAbilitySaveFast(actor, id, rollMode)); }
  async _handleSkillCheckFast(id, rollMode) { await this._safeRun("技能检定", (actor) => rollSkillCheckFast(actor, id, rollMode)); }
  async _handleStatusToggle(statusId) {
    await this._safeRun("切换状态", async (actor) => {
      await actor.toggleStatusEffect(statusId);
      this._scheduleRerender();
    });
  }

  async _handleStatusToggleOverlay(statusId) {
    await this._safeRun("切换状态(覆盖)", async (actor) => {
      const tokenDoc = this._getBoundToken()?.document;
      const isActive = tokenDoc?.hasStatusEffect?.(statusId) ?? false;
      if (isActive) {
        await actor.toggleStatusEffect(statusId, { active: false });
        this._scheduleRerender();
        return;
      }
      await actor.toggleStatusEffect(statusId, { active: true, overlay: true });
      this._scheduleRerender();
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

  async _handleExtraEffectToggle(effectUuid) {
    await this._safeRun("切换效应", async (actor) => {
      const effect = effectUuid ? await fromUuid(effectUuid) : null;
      if (!effect || effect.documentName !== "ActiveEffect") return warn("AQB：未找到该效应。");
      const ownerActor = (effect.parent?.documentName === "Actor") ? effect.parent : effect.parent?.parent;
      if (ownerActor?.documentName === "Actor" && ownerActor?.id !== actor.id) return;
      await effect.update({ disabled: !Boolean(effect.disabled) });
      this._scheduleRerender();
    });
  }

  async _handleExtraEffectDelete(effectUuid) {
    await this._safeRun("删除效应", async (actor) => {
      const effect = effectUuid ? await fromUuid(effectUuid) : null;
      if (!effect || effect.documentName !== "ActiveEffect") return;
      if (effect.parent?.documentName !== "Actor") return;
      const ownerActor = effect.parent;
      if (ownerActor?.id !== actor.id) return;
      await effect.delete();
      this._scheduleRerender();
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
    const desiredWidth = Math.max(1010, Math.floor(window.innerWidth / 2));
    const padding = 10;
    const width = Math.min(desiredWidth, window.innerWidth - padding * 2);
    const defaultHeight = (typeof this.position?.height === "number") ? this.position.height : 300;
    const height = Math.min(defaultHeight, window.innerHeight - padding * 2); 
    const left = Math.max(padding, Math.floor((window.innerWidth - width) / 2));
    const top = Math.max(padding, Math.floor(window.innerHeight - height - padding));
    this.setPosition({ left, top, width, height });
  }

  _onClose(options) {
    super._onClose(options);
    this._closeItemPopover();
    Hooks.callAll("closeAqbDashboardApp");
    Hooks.off("updateActor", this._handleUpdate);
    Hooks.off("updateToken", this._handleUpdate);
    Hooks.off("createActiveEffect", this._handleUpdate);
    Hooks.off("updateActiveEffect", this._handleUpdate);
    Hooks.off("deleteActiveEffect", this._handleUpdate);
    Hooks.off("updateItem", this._handleUpdate);
    Hooks.off("createItem", this._handleUpdate);
    Hooks.off("deleteItem", this._handleUpdate);
    Hooks.off("controlToken", this._handleControlToken);
    if (this._rerenderTimer) window.clearTimeout(this._rerenderTimer);
    ui.controls?.render();
  }
}

