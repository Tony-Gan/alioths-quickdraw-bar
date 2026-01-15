function isCancelError(err) {
  if (!err) return false;
  const msg = String(err?.message ?? err);
  return /cancel|canceled|cancelled|aborted|dismissed|closed|dialog|对话框|no roll|no result|未掷骰|没有掷骰|未进行|用户取消|已取消|已关闭/i.test(msg) || msg.trim() === "";
}

function buildFastForwardEvent(rollMode) {
  const mode = String(rollMode ?? "normal").toLowerCase();
  const advantage = ["adv", "advantage", "a", "+"].includes(mode);
  const disadvantage = ["dis", "disadv", "disadvantage", "d", "-"].includes(mode);
  return { shiftKey: true, altKey: advantage, ctrlKey: disadvantage, metaKey: false };
}

async function fastForwardCall(callers) {
  for (const fn of callers) {
    try {
      return await fn();
    } catch (_e) { /* fall through */ }
  }
  return null;
}

export async function rollAbilityCheck(actor, abilityId) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollAbilityCheck({ ability: abilityId });
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollAbilityCheckFast(actor, abilityId, rollMode = "normal") {
  if (!actor) throw new Error("未找到角色数据。");
  const event = buildFastForwardEvent(rollMode);
  try {
    return await fastForwardCall([
      () => actor.rollAbilityCheck({ ability: abilityId, event }),
      () => actor.rollAbilityCheck(abilityId, { event }),
      () => actor.rollAbilityCheck({ ability: abilityId, event, fastForward: true, dialog: false })
    ]);
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollAbilitySave(actor, abilityId) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollSavingThrow({ ability: abilityId });
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollAbilitySaveFast(actor, abilityId, rollMode = "normal") {
  if (!actor) throw new Error("未找到角色数据。");
  const event = buildFastForwardEvent(rollMode);
  try {
    return await fastForwardCall([
      () => actor.rollSavingThrow({ ability: abilityId, event }),
      () => actor.rollSavingThrow(abilityId, { event }),
      () => actor.rollSavingThrow({ ability: abilityId, event, fastForward: true, dialog: false })
    ]);
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollSkillCheck(actor, skillId) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollSkill({ skill: skillId });
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollSkillCheckFast(actor, skillId, rollMode = "normal") {
  if (!actor) throw new Error("未找到角色数据。");
  const event = buildFastForwardEvent(rollMode);
  try {
    return await fastForwardCall([
      () => actor.rollSkill({ skill: skillId, event }),
      () => actor.rollSkill(skillId, { event }),
      () => actor.rollSkill({ skill: skillId, event, fastForward: true, dialog: false })
    ]);
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollInitiativeCheck(actor) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollInitiative({ createCombatants: false });
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollInitiativeCheckFast(actor, rollMode = "normal") {
  if (!actor) throw new Error("未找到角色数据。");
  const event = buildFastForwardEvent(rollMode);
  try {
    return await fastForwardCall([
      () => actor.rollInitiative({ createCombatants: false, event }),
      () => actor.rollInitiative(undefined, { event }),
      () => actor.rollInitiative({ createCombatants: false, event, fastForward: true, dialog: false })
    ]);
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

export async function rollDeathSave(actor) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollDeathSave();
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}