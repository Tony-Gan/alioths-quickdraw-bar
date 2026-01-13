import { MODULE_ID, SETTINGS } from "../constants.js";

/**
 * 选择绑定 Token 的优先级：
 * 1) 当前选中的（controlled）Token
 * 2) 上次记录的 Token（在当前场景仍存在且当前用户可用）
 * 3) 当前场景里，当前用户拥有（owner）的第一个 Token
 */
export function getDefaultBindableToken() {
  const controlled = canvas?.tokens?.controlled?.[0];
  if (controlled) return controlled;

  const lastUuid = game.settings.get(MODULE_ID, SETTINGS.LAST_TOKEN_UUID);
  const last = lastUuid ? fromUuidSync(lastUuid) : null;
  if (last?.document && isBindableToken(last)) return last;

  const owned = getOwnedTokensInScene();
  return owned[0] ?? null;
}

export function getOwnedTokensInScene() {
  const placeables = canvas?.tokens?.placeables ?? [];
  return placeables.filter((t) => isBindableToken(t));
}

export function isBindableToken(token) {
  try {
    // TokenDocument#isOwner：当前用户是否拥有 Token
    return Boolean(token?.document?.isOwner);
  } catch {
    return false;
  }
}

export function storeLastToken(token) {
  const uuid = token?.document?.uuid ?? "";
  game.settings.set(MODULE_ID, SETTINGS.LAST_TOKEN_UUID, uuid);
}
