import { MODULE_ID } from "../constants.js";

function isCancelError(err) {
  if (!err) return false;
  const msg = String(err?.message ?? err);
  return /cancel|canceled|cancelled|aborted|dismissed|closed|用户取消|已取消|已关闭/i.test(msg);
}

export async function useDnd5eItem(item) {
  if (!item) throw new Error("未找到物品数据。");
  try {
    if (typeof item.use === "function") {
      return await item.use();
    }
    throw new Error("该物品不支持 use() 方法。");
  } catch (err) {
    if (isCancelError(err)) return null;
    throw err;
  }
}

function hasCJK(text) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(text ?? ""));
}

export function getItemName(item) {
  if (!item) return "";
  const alias = item.getFlag(MODULE_ID, "alias");
  if (alias) return alias;

  const original = String(item.name ?? "").trim();
  if (!original) return "";

  const m = original.match(/^(\S+)\s+(.+)$/);
  if (!m) return original;

  const first = m[1];
  if (hasCJK(first)) return first;

  return original;
}
