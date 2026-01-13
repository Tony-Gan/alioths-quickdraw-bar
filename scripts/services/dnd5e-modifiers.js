function isNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

export function formatSigned(n) {
  if (!isNumber(n)) return "—";
  if (n === 0) return "+0";
  return n > 0 ? `+${n}` : `${n}`;
}

function getProfBonus(actor) {
  const prof = actor?.system?.attributes?.prof;
  return isNumber(prof) ? prof : 0;
}

function getAbilityScore(actor, abilityId) {
  const abi = actor?.system?.abilities?.[abilityId];
  const score = abi?.value ?? abi?.score;
  return isNumber(score) ? score : null;
}

function getAbilityMod(actor, abilityId) {
  const abi = actor?.system?.abilities?.[abilityId];
  if (isNumber(abi?.mod)) return abi.mod;

  const score = getAbilityScore(actor, abilityId);
  if (!isNumber(score)) return null;
  return Math.floor(score / 2) - 5;
}

function isSaveProficient(actor, abilityId) {
  const abi = actor?.system?.abilities?.[abilityId];
  return Number(abi?.proficient) >= 1;
}

function getSkillTotalMod(actor, skillId) {
  const sk = actor?.system?.skills?.[skillId];
  if (isNumber(sk?.mod)) return sk.mod;
  return null;
}

export function getAbilityCheckBonus(actor, abilityId) {
  return getAbilityMod(actor, abilityId);
}

export function getAbilitySaveBonus(actor, abilityId) {
  const abi = actor?.system?.abilities?.[abilityId];
  if (isNumber(abi?.save)) return abi.save;

  const base = getAbilityMod(actor, abilityId);
  if (!isNumber(base)) return null;
  const prof = isSaveProficient(actor, abilityId) ? getProfBonus(actor) : 0;
  return base + prof;
}

export function getSkillCheckBonus(actor, skillId) {
  return getSkillTotalMod(actor, skillId);
}

export function getInitiativeBonus(actor) {
  const init = actor?.system?.attributes?.init;
  
  if (isNumber(init?.total)) return init.total;

  const dex = getAbilityMod(actor, "dex");
  if (!isNumber(dex)) return null;
  const bonus = isNumber(init?.bonus) ? init.bonus : 0;
  return dex + bonus;
}

export function getDeathSaveBonus(actor) {
  return 0;
}