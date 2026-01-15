import { TABS, ABILITIES, SKILL_GROUPS, SETTINGS, MODULE_ID, FEATURE_AUTO_HIDE_NAME_MAP } from "../constants.js";
import { getOwnedTokensInScene, getDefaultBindableToken, storeLastToken } from "./token-binding.js";
import { getAbilityCheckBonus, getAbilitySaveBonus, getSkillCheckBonus, getInitiativeBonus, getDeathSaveBonus, formatSigned } from "./dnd5e-modifiers.js";
import { getSpellSlotsSummary, getActorSpellItems, groupSpellsByLevel, groupSpellsByCastingTime } from "./dnd5e-spells.js"; 
import { getActorOwnedItemDocuments, groupItemsByType, groupItemsByUseTime } from "./dnd5e-items.js"; 
import { getActorFeatureButtons, groupFeatureButtonsByUseTime } from "./dnd5e-features.js";
import { warn } from "../utils/notify.js";

const COMMON_STATUS_DEFS = [
  { statusId: "blinded", label: "目盲", sort: "Blinded" },
  { statusId: "charmed", label: "魅惑", sort: "Charmed" },
  { statusId: "deafened", label: "耳聋", sort: "Deafened" },
  { statusId: "frightened", label: "恐慌", sort: "Frightened" },
  { statusId: "grappled", label: "受擒", sort: "Grappled" },
  { statusId: "incapacitated", label: "失能", sort: "Incapacitated" },
  { statusId: "invisible", label: "隐形", sort: "Invisible" },
  { statusId: "poisoned", label: "中毒", sort: "Poisoned" },
  { statusId: "prone", label: "倒地", sort: "Prone" },
  { statusId: "restrained", label: "束缚", sort: "Restrained" },
  { statusId: "stunned", label: "震慑", sort: "Stunned" },
  { statusId: "unconscious", label: "昏迷", sort: "Unconscious" }
];

const COMMON_STATUS_IDS = COMMON_STATUS_DEFS.map((s) => s.statusId);

const MOVEMENT_ACTION_LABELS_ZH = { 
  walk: "步行", 
  fly: "飞行", 
  swim: "游泳", 
  climb: "攀爬", 
  burrow: "掘穴", 
  teleport: "传送", 
  blink: "传送", 
  Blink: "传送" 
}; 

export async function buildDashboardContext(currentTokenId, activeTab, spellsSortMode, spellsUnpreparedMode, spellsHideMode, itemsSortMode, itemsHideMode, featuresHiddenMode, featuresSortMode) {
  const ownedTokens = getOwnedTokensInScene();
  const controlled = canvas?.tokens?.controlled?.[0];

  let boundToken = null;
  if (currentTokenId) {
    boundToken = canvas.tokens.placeables.find(t => t.id === currentTokenId);
  }

  if (!boundToken) {
    boundToken = getDefaultBindableToken();
    if (boundToken) storeLastToken(boundToken);
  }

  const finalTokenId = boundToken?.id ?? null;
  const actor = boundToken?.actor ?? null;
  const buttonsDisabled = !actor;
  const genericIcon = "icons/svg/d20-black.svg";

  const sortOrders = actor?.getFlag?.(MODULE_ID, "sortOrders") ?? actor?.flags?.[MODULE_ID]?.sortOrders ?? {};
  const getManualOrder = (sortKey) => {
    const v = sortOrders?.[sortKey];
    return Array.isArray(v) ? v : [];
  };
  const applyManualOrder = (list, orderIds, getId = (x) => x?.id) => {
    const arr = Array.isArray(list) ? list.slice() : [];
    const order = Array.isArray(orderIds) ? orderIds : [];
    if (!order.length || arr.length <= 1) return arr;
    const idx = new Map(order.map((id, i) => [String(id), i]));
    const withPos = arr.map((it, i) => {
      const id = String(getId(it) ?? "");
      const p = idx.has(id) ? idx.get(id) : (order.length + i);
      return { it, p, i };
    });
    withPos.sort((a, b) => (a.p - b.p) || (a.i - b.i));
    return withPos.map((x) => x.it);
  };
  
  const abilityChecks = ABILITIES.map((a) => ({
    id: a.id,
    label: a.label,
    icon: genericIcon,
    mod: formatSigned(getAbilityCheckBonus(actor, a.id))
  }));

  const abilitySaves = ABILITIES.map((a) => ({
    id: a.id,
    label: a.label,
    icon: genericIcon,
    mod: formatSigned(getAbilitySaveBonus(actor, a.id))
  }));

  const allSkillGroups = SKILL_GROUPS.map((g) => ({
    ...g,
    skills: g.skills.map((s) => ({
      ...s,
      icon: genericIcon,
      mod: formatSigned(getSkillCheckBonus(actor, s.id))
    }))
  }));

  const skillsRow1 = allSkillGroups.filter(g => ["str", "dex"].includes(g.key));
  const skillsRow2 = allSkillGroups.filter(g => g.key === "int");
  const skillsRow3 = allSkillGroups.filter(g => g.key === "wis");
  const skillsRow4 = allSkillGroups.filter(g => g.key === "cha");

  const initiativeMod = formatSigned(getInitiativeBonus(actor));
  const deathSaveMod = formatSigned(getDeathSaveBonus(actor));

  const spellSlotsSummary = getSpellSlotsSummary(actor);
  const spellItems = getActorSpellItems(actor);
  const spellSections = spellsSortMode === "time" 
    ? groupSpellsByCastingTime(spellItems) 
    : groupSpellsByLevel(spellItems);

  const ownedItems = getActorOwnedItemDocuments(actor);
  const itemSectionsRaw = itemsSortMode === "time"
    ? groupItemsByUseTime(ownedItems)
    : groupItemsByType(ownedItems, itemsSortMode === "type-consumable" ? "consumable" : "weapon");

  const allFeatureButtons = getActorFeatureButtons(actor);
  const safeFeaturesSortMode = (featuresSortMode === "time") ? "time" : "default";
  const hiddenMode = (featuresHiddenMode === "disable") ? "disable" : "hide";

  const featureButtonsProcessed = (allFeatureButtons ?? []);

  const unpreparedMode = spellsUnpreparedMode || "disable";

  const safeItemsHideMode = (itemsHideMode === "disable") ? "disable" : "hide";
  const safeSpellsHideMode = (spellsHideMode === "disable") ? "disable" : "hide";

  const isFlaggedHidden = (itemId) => {
    const it = actor?.items?.get?.(itemId);
    const flag = it?.getFlag?.(MODULE_ID, "hidden") ?? it?.flags?.[MODULE_ID]?.hidden;
    return Boolean(flag);
  };

  const isFlaggedFavorited = (itemId) => {
    const it = actor?.items?.get?.(itemId);
    const flag = it?.getFlag?.(MODULE_ID, "favorited") ?? it?.flags?.[MODULE_ID]?.favorited;
    return Boolean(flag);
  };

  const featureButtonsHiddenProcessed = (featureButtonsProcessed ?? [])
    .map((f) => {
      const autoHidden = FEATURE_AUTO_HIDE_NAME_MAP.has(f.name);
      const isHidden = isFlaggedHidden(f.id) || autoHidden;
      if (isHidden && hiddenMode === "hide") return null;
      return {
        ...f,
        favorited: isFlaggedFavorited(f.id),
        disabled: Boolean(f.disabled) || (isHidden && hiddenMode === "disable")
      };
    })
    .filter((f) => Boolean(f));

  const featureItemsSortKey = "features:all";
  const featureItems = applyManualOrder(featureButtonsHiddenProcessed, getManualOrder(featureItemsSortKey));

  const spellSectionsProcessed = (spellSections ?? [])
    .map((section) => {
      const sortKey = `spells:${section.key ?? section.title ?? ""}`;
      const spellsRaw = (section.spells ?? [])
        .filter((s) => unpreparedMode !== "hide" || s.prepState !== "unprepared")
        .map((s) => {
          const isHidden = isFlaggedHidden(s.id);
          if (isHidden && safeSpellsHideMode === "hide") return null;
          return {
            ...s,
            favorited: isFlaggedFavorited(s.id),
            disabled: (unpreparedMode === "disable" && s.prepState === "unprepared") || (isHidden && safeSpellsHideMode === "disable")
          };
        })
        .filter((s) => Boolean(s));
      const spells = applyManualOrder(spellsRaw, getManualOrder(sortKey));
      return { ...section, sortKey, spells };
    })
    .filter((section) => (section.spells?.length ?? 0) > 0);

  const itemSectionsProcessed = (itemSectionsRaw ?? [])
    .map((section) => {
      const sortKey = `items:${section.key ?? section.title ?? ""}`;
      const itemsRaw = (section.items ?? [])
        .map((it) => {
          const isHidden = isFlaggedHidden(it.id);
          if (isHidden && safeItemsHideMode === "hide") return null;
          return {
            ...it,
            favorited: isFlaggedFavorited(it.id),
            disabled: Boolean(it.disabled) || (isHidden && safeItemsHideMode === "disable")
          };
        })
        .filter((it) => Boolean(it));
      const items = applyManualOrder(itemsRaw, getManualOrder(sortKey));
      return { ...section, sortKey, items };
    })
    .filter((section) => (section.items?.length ?? 0) > 0);

  const favoriteItemsSortKey = "favorites:items";
  const favoriteFeaturesSortKey = "favorites:features";
  const favoriteSpellsSortKey = "favorites:spells";

  const favoriteItemsRaw = (itemSectionsRaw ?? [])
    .flatMap((section) => (section.items ?? []))
    .filter((it) => isFlaggedFavorited(it.id));
  const favoriteItems = applyManualOrder(favoriteItemsRaw, getManualOrder(favoriteItemsSortKey));

  const favoriteFeaturesRaw = (featureButtonsProcessed ?? [])
    .filter((f) => isFlaggedFavorited(f.id));
  const favoriteFeatures = applyManualOrder(favoriteFeaturesRaw, getManualOrder(favoriteFeaturesSortKey));

  const favoriteSpellsRaw = (spellSections ?? [])
    .flatMap((section) => (section.spells ?? []))
    .filter((s) => isFlaggedFavorited(s.id))
    .map((s) => {
      const isHidden = isFlaggedHidden(s.id);
      const unprepared = s.prepState === "unprepared";
      const disabled = (unprepared && unpreparedMode !== "ignore") || (isHidden && safeSpellsHideMode === "disable");
      return { ...s, disabled };
    });
  const favoriteSpells = applyManualOrder(favoriteSpellsRaw, getManualOrder(favoriteSpellsSortKey));

  const hasFavoriteItems = (favoriteItems?.length ?? 0) > 0;
  const hasFavoriteFeatures = (favoriteFeatures?.length ?? 0) > 0;
  const hasFavoriteSpells = (favoriteSpells?.length ?? 0) > 0;
  const hasFavorites = hasFavoriteItems || hasFavoriteFeatures || hasFavoriteSpells;

  const spellsSortModes = [
    { value: "level", label: "按环位", selected: spellsSortMode === "level" },
    { value: "time", label: "按施法时间", selected: spellsSortMode === "time" }
  ];

  const itemsSortModes = [
    { value: "type-weapon", label: "按类型/武器优先", selected: (itemsSortMode ?? "type-weapon") === "type-weapon" },
    { value: "type-consumable", label: "按类型/消耗品优先", selected: itemsSortMode === "type-consumable" },
    { value: "time", label: "按使用时间", selected: itemsSortMode === "time" }
  ];

  const itemsHideModes = [
    { value: "hide", label: "隐藏", selected: safeItemsHideMode === "hide" },
    { value: "disable", label: "显示", selected: safeItemsHideMode === "disable" }
  ];

  const featuresHiddenModes = [
    { value: "hide", label: "隐藏", selected: hiddenMode === "hide" },
    { value: "disable", label: "显示", selected: hiddenMode === "disable" }
  ];

  const featuresSortModes = [
    { value: "default", label: "默认", selected: safeFeaturesSortMode === "default" },
    { value: "time", label: "按释放时间", selected: safeFeaturesSortMode === "time" }
  ];

  const featureSectionsRaw = (safeFeaturesSortMode === "time")
    ? groupFeatureButtonsByUseTime(featureItems)
    : [];

  const featureSections = (featureSectionsRaw ?? [])
    .map((section) => {
      const sortKey = `features:${section.key ?? section.title ?? ""}`;
      const items = applyManualOrder(section.items ?? [], getManualOrder(sortKey));
      return { ...section, sortKey, items };
    })
    .filter((section) => (section.items?.length ?? 0) > 0);

  const spellsHideModes = [
    { value: "hide", label: "隐藏", selected: safeSpellsHideMode === "hide" },
    { value: "disable", label: "显示", selected: safeSpellsHideMode === "disable" }
  ];

  const spellsUnpreparedModes = [
    { value: "disable", label: "按钮禁用", selected: unpreparedMode === "disable" },
    { value: "ignore", label: "忽略", selected: unpreparedMode === "ignore" },
    { value: "hide", label: "隐藏", selected: unpreparedMode === "hide" }
  ];

  const tabs = TABS.map((t) => ({ ...t, active: t.key === activeTab }));

  const stateMoveCommonStatusButtons = buildCommonStatusButtons(boundToken, buttonsDisabled);
  const stateMoveExtraStatusButtons = buildExtraStatusButtons(actor, buttonsDisabled);
  const stateMoveMovementButtons = buildMovementButtons(boundToken, buttonsDisabled);

  return {
    finalTokenId,


    shouldWarnNoToken: !ownedTokens.length,

    hasBoundToken: Boolean(boundToken),
    hasTokens: ownedTokens.length > 0,
    boundTokenName: boundToken?.name ?? "（未绑定 Token）",
    controlledTokenName: controlled?.name ?? null,
    tokens: ownedTokens.map((t) => ({
      id: t.id,
      name: t.name,
      selected: t.id === finalTokenId
    })),

    tabs,
    
    activeTab,
    isTabItems: activeTab === "items",
    isTabFeatures: activeTab === "features",
    isTabSpells: activeTab === "spells",
    isTabChecks: activeTab === "checks",
    isTabStateMove: activeTab === "stateMove",
    isTabCustom: activeTab === "custom",

    buttonsDisabled,
    genericIcon,

    stateMoveExtraStatusButtons,
    stateMoveCommonStatusButtons,
    stateMoveMovementButtons,

    abilityChecks,

    abilitySaves,
    skillsRow1,
    skillsRow2,
    skillsRow3,
    skillsRow4,
    initiativeMod,
    deathSaveMod,

    featuresHiddenModes,
    featuresSortModes,
    featureSections,
    hasFeatureSections: (featureSections?.length ?? 0) > 0,
    featureItemsSortKey, 
    featureItems: featureItems,
    hasFeatureItems: (featureItems?.length ?? 0) > 0,

    spellSlotsSummary,
    spellsSortModes,
    spellsUnpreparedModes,
    spellsHideModes,

    spellSections: spellSectionsProcessed,
    hasSpellSections: (spellSectionsProcessed?.length ?? 0) > 0,

    favoriteItemsSortKey,
    favoriteFeaturesSortKey,
    favoriteSpellsSortKey,
    favoriteItems,
    favoriteFeatures,
    favoriteSpells,
    hasFavorites,
    hasFavoriteItems,
    hasFavoriteFeatures,
    hasFavoriteSpells,

    itemsSortModes,
    itemsHideModes,
    itemSections: itemSectionsProcessed,
    hasItemSections: (itemSectionsProcessed?.length ?? 0) > 0 
  };
}

function buildCommonStatusButtons(boundToken, buttonsDisabled) {
  const tokenDoc = boundToken?.document ?? null;
  const actor = boundToken?.actor ?? null;
  const statusEffects = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];

  const hasTokenStatus = (id) => {
    if (!id) return false;
    if (typeof tokenDoc?.hasStatusEffect === "function") return Boolean(tokenDoc.hasStatusEffect(id));
    const statuses = tokenDoc?.statuses;
    if (statuses instanceof Set) return statuses.has(id);
    if (Array.isArray(statuses)) return statuses.includes(id);
    return false;
  };

  const hasActorStatus = (id) => {
    if (!id || !actor) return false;

    const actorStatuses = actor?.statuses;
    if (actorStatuses instanceof Set && actorStatuses.has(id)) return true;
    if (Array.isArray(actorStatuses) && actorStatuses.includes(id)) return true;

    const effects = Array.isArray(actor.appliedEffects) ? actor.appliedEffects : (actor.effects?.contents ?? []);
    for (const e of effects) {
      if (!e || e.isSuppressed || e.disabled) continue;
      const statuses = e.statuses;
      if (!(statuses instanceof Set)) continue;
      for (const s of statuses) {
        const sid = String(s ?? "");
        if (!sid) continue;
        if (sid === id) return true;
        if (typeof id === "string" && sid.endsWith(`.${id}`)) return true;
      }
    }
    return false;
  };

  const findCfg = (statusId) => {
    return statusEffects.find((e) => e?.id === statusId || e?.statusId === statusId)
      ?? statusEffects.find((e) => e?.id === `dnd5e.${statusId}` || e?.statusId === `dnd5e.${statusId}`)
      ?? statusEffects.find((e) => String(e?.id ?? e?.statusId ?? "").endsWith(`.${statusId}`));
  };

  return COMMON_STATUS_DEFS
    .slice()
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((s) => {
      const cfg = findCfg(s.statusId);
      const cfgId = cfg?.id ?? cfg?.statusId ?? null;
      const idsToCheck = [s.statusId];
      if (cfgId && !idsToCheck.includes(cfgId)) idsToCheck.push(cfgId);
      if (cfgId && typeof cfgId === "string" && cfgId.includes(".")) {
        const suffix = cfgId.split(".").pop();
        if (suffix && !idsToCheck.includes(suffix)) idsToCheck.push(suffix);
      }

      return {
        statusId: s.statusId,
        label: s.label,
        icon: cfg?.img ?? cfg?.icon ?? "",
        toggled: idsToCheck.some((id) => hasTokenStatus(id) || hasActorStatus(id)), 
        disabled: Boolean(buttonsDisabled)
      };
    });
}

function buildExtraStatusButtons(actor, buttonsDisabled) {
  if (!actor) return [];

  const commonSet = new Set(COMMON_STATUS_IDS);
  const excludedStatusIds = new Set(["hide", "hidden"]);
  const appliedEffects = Array.isArray(actor.appliedEffects) ? actor.appliedEffects : [];
  const appliedUuids = new Set(appliedEffects.map((e) => e?.uuid).filter(Boolean));
  const actorEffects = (actor.effects?.contents ?? []);

  const effectPool = [];
  for (const e of actorEffects) effectPool.push(e);

  for (const it of (actor.items?.contents ?? [])) {
    const itemEffects = it?.effects?.contents ?? [];
    for (const e of itemEffects) {
      const uuid = e?.uuid;
      if (!uuid) continue;
      if (appliedUuids.has(uuid) || Boolean(e.disabled)) effectPool.push(e);
    }
  }

  const seen = new Set();

  return effectPool
    .filter((e) => {
      if (!e || !e.uuid) return false;
      if (seen.has(e.uuid)) return false;
      seen.add(e.uuid);
      if (e?.isSuppressed) return false;
      const statuses = e?.statuses;
      if (!(statuses instanceof Set)) return true;
      for (const s of statuses) {
        const sid = String(s ?? "");
        if (!sid) continue;
        const suffix = sid.includes(".") ? sid.split(".").pop() : sid;
        if (excludedStatusIds.has(suffix)) return false;
        if (commonSet.has(suffix)) return false;
      }
      return true;
    })
    .map((e) => ({
      effectKey: e.uuid,
      effectId: e.id,
      label: e.name ?? "",
      icon: e.img ?? e.icon ?? e.parent?.img ?? "",
      toggled: !Boolean(e.disabled) && !Boolean(e.isSuppressed),
      disabled: Boolean(buttonsDisabled)
    }))
    .sort((a, b) => (a.label || "").localeCompare((b.label || "")));
}

function buildMovementButtons(boundToken, buttonsDisabled) {
  const tokenDoc = boundToken?.document ?? null;
  if (!tokenDoc) return [];

  const actions = CONFIG?.Token?.movement?.actions ?? {};
  const defaultAction = CONFIG?.Token?.movement?.defaultAction ?? "walk";
  const currentAction = tokenDoc?.movementAction ?? defaultAction;

  const baseOrder = ["walk", "fly", "swim", "climb", "burrow"];
  const extraOrder = ["teleport", "blink", "Blink"].filter((id) => Boolean(actions?.[id]));
  const actionOrder = [...baseOrder, ...extraOrder].filter((id) => Boolean(actions?.[id]));

  return actionOrder
    .map((actionId) => {
      const cfg = actions?.[actionId] ?? null;
      if (!cfg) return null;
      const canSelect = typeof cfg?.canSelect === "function" ? cfg.canSelect(tokenDoc) : true;
      const labelKey = cfg?.label ?? cfg?.name ?? actionId;
      const localized = game.i18n?.localize?.(labelKey) ?? labelKey;
      const label = MOVEMENT_ACTION_LABELS_ZH[actionId] ?? localized;
      const toggled = currentAction === actionId;
      return {
        actionId,
        label,
        icon: cfg?.img ?? null,
        iconClass: cfg?.img ? null : (cfg?.icon ?? null),
        toggled,
        disabled: Boolean(buttonsDisabled) || (!canSelect && !toggled)
      };
    })
    .filter((b) => Boolean(b?.actionId));
}
