import { TABS, ABILITIES, SKILL_GROUPS, SETTINGS, MODULE_ID } from "../constants.js";
import { getOwnedTokensInScene, getDefaultBindableToken, storeLastToken } from "./token-binding.js";
import { getAbilityCheckBonus, getAbilitySaveBonus, getSkillCheckBonus, getInitiativeBonus, getDeathSaveBonus, formatSigned } from "./dnd5e-modifiers.js";
import { getSpellSlotsSummary, getActorSpellItems, groupSpellsByLevel, groupSpellsByCastingTime } from "./dnd5e-spells.js"; 
import { getActorOwnedItemDocuments, groupItemsByType, groupItemsByUseTime } from "./dnd5e-items.js"; 
import { getActorFeatureButtons } from "./dnd5e-features.js";
import { warn } from "../utils/notify.js";

const COMMON_STATUS_DEFS = [
  { statusId: "blinded", label: "目盲", sort: "Blinded" },
  { statusId: "deafened", label: "耳聋", sort: "Deafened" },
  { statusId: "grappled", label: "受擒", sort: "Grappled" },
  { statusId: "hide", label: "隐匿", sort: "Hidden" }, 
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

export async function buildDashboardContext(currentTokenId, activeTab, spellsSortMode, spellsUnpreparedMode, spellsHideMode, itemsSortMode, itemsHideMode, featuresPassiveMode, featuresHiddenMode) {
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
  const passiveMode = featuresPassiveMode || "show";
  const hiddenMode = (featuresHiddenMode === "disable") ? "disable" : "hide";

  const featureButtonsProcessed = passiveMode === "hide"
    ? (allFeatureButtons ?? []).filter((f) => !f.isPassive)
    : (allFeatureButtons ?? []);

  const unpreparedMode = spellsUnpreparedMode || "disable";

  const safeItemsHideMode = (itemsHideMode === "disable") ? "disable" : "hide";
  const safeSpellsHideMode = (spellsHideMode === "disable") ? "disable" : "hide";

  const isFlaggedHidden = (itemId) => {
    const it = actor?.items?.get?.(itemId);
    const flag = it?.getFlag?.(MODULE_ID, "hidden") ?? it?.flags?.[MODULE_ID]?.hidden;
    return Boolean(flag);
  };

  const featureButtonsHiddenProcessed = (featureButtonsProcessed ?? [])
    .map((f) => {
      const isHidden = isFlaggedHidden(f.id);
      if (isHidden && hiddenMode === "hide") return null;
      return {
        ...f,
        disabled: Boolean(f.disabled) || (isHidden && hiddenMode === "disable")
      };
    })
    .filter((f) => Boolean(f));

  const spellSectionsProcessed = (spellSections ?? [])
    .map((section) => {
      const spells = (section.spells ?? [])
        .filter((s) => unpreparedMode !== "hide" || s.prepState !== "unprepared")
        .map((s) => {
          const isHidden = isFlaggedHidden(s.id);
          if (isHidden && safeSpellsHideMode === "hide") return null;
          return {
            ...s,
            disabled: (unpreparedMode === "disable" && s.prepState === "unprepared") || (isHidden && safeSpellsHideMode === "disable")
          };
        })
        .filter((s) => Boolean(s));
      return { ...section, spells };
    })
    .filter((section) => (section.spells?.length ?? 0) > 0);

  const itemSectionsProcessed = (itemSectionsRaw ?? [])
    .map((section) => {
      const items = (section.items ?? [])
        .map((it) => {
          const isHidden = isFlaggedHidden(it.id);
          if (isHidden && safeItemsHideMode === "hide") return null;
          return {
            ...it,
            disabled: Boolean(it.disabled) || (isHidden && safeItemsHideMode === "disable")
          };
        })
        .filter((it) => Boolean(it));
      return { ...section, items };
    })
    .filter((section) => (section.items?.length ?? 0) > 0);

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

  const featuresPassiveModes = [
    { value: "show", label: "显示", selected: passiveMode === "show" },
    { value: "hide", label: "隐藏", selected: passiveMode === "hide" }
  ];

  const featuresHiddenModes = [
    { value: "hide", label: "隐藏", selected: hiddenMode === "hide" },
    { value: "disable", label: "显示", selected: hiddenMode === "disable" }
  ];

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

    featuresPassiveModes,
    featuresHiddenModes,
    featureItems: featureButtonsHiddenProcessed,
    hasFeatureItems: (featureButtonsHiddenProcessed?.length ?? 0) > 0,

    spellSlotsSummary,
    spellsSortModes,
    spellsUnpreparedModes,
    spellsHideModes,

    spellSections: spellSectionsProcessed,
    hasSpellSections: (spellSectionsProcessed?.length ?? 0) > 0,

    itemsSortModes,
    itemsHideModes,
    itemSections: itemSectionsProcessed,
    hasItemSections: (itemSectionsProcessed?.length ?? 0) > 0 
  };
}

function buildCommonStatusButtons(boundToken, buttonsDisabled) {
  const tokenDoc = boundToken?.document ?? null;
  const statusEffects = Array.isArray(CONFIG?.statusEffects) ? CONFIG.statusEffects : [];

  const hasStatus = (id) => {
    if (!id) return false;
    if (typeof tokenDoc?.hasStatusEffect === "function") return Boolean(tokenDoc.hasStatusEffect(id));
    const statuses = tokenDoc?.statuses;
    if (statuses instanceof Set) return statuses.has(id);
    if (Array.isArray(statuses)) return statuses.includes(id);
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
        toggled: idsToCheck.some((id) => hasStatus(id)),
        disabled: Boolean(buttonsDisabled)
      };
    });
}

function buildExtraStatusButtons(actor, buttonsDisabled) {
  if (!actor) return [];

  const commonSet = new Set(COMMON_STATUS_IDS);
  const effects = Array.isArray(actor.appliedEffects) ? actor.appliedEffects : (actor.effects?.contents ?? []);

  return effects
    .filter((e) => {
      if (e?.isSuppressed) return false;
      const statuses = e?.statuses;
      if (!(statuses instanceof Set)) return true;
      for (const s of statuses) {
        if (commonSet.has(String(s))) return false;
      }
      return true;
    })
    .map((e) => ({
      effectKey: e.uuid,
      effectId: e.id,
      label: e.name ?? "",
      icon: e.img ?? e.icon ?? e.parent?.img ?? "",
      toggled: !Boolean(e.disabled),
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
