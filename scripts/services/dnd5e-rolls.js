function isCancelError(err) {
  if (!err) return false;
  const msg = String(err?.message ?? err);
  return /cancel|canceled|cancelled|aborted|dismissed|closed|dialog|对话框|no roll|no result|未掷骰|没有掷骰|未进行|用户取消|已取消|已关闭/i.test(msg) || msg.trim() === "";
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

export async function rollAbilitySave(actor, abilityId) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollSavingThrow({ ability: abilityId });
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

export async function rollInitiativeCheck(actor) {
  if (!actor) throw new Error("未找到角色数据。");
  try {
    return await actor.rollInitiative({ createCombatants: false });
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