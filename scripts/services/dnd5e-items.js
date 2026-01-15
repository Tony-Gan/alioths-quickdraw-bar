import { getItemName } from "./dnd5e-item-use.js";

const TYPE_TITLES = {
  weapon: "武器",
  equipment: "装备",
  consumable: "消耗品",
  tool: "工具",
  loot: "杂项",
  backpack: "背包",
  container: "容器",
  background: "背景",
  race: "种族"
};

export function getActorOwnedItemDocuments(actor) {
  if (!actor) return [];
  return (actor.items?.contents ?? actor.items ?? [])
    .filter((i) => i && i.type !== "spell" && i.type !== "feat")
    .filter((i) => i.type !== "class" && i.type !== "subclass")
    .filter((i) => i.type !== "background" && i.type !== "race") ?? [];
}

function formatItemUses(item) {
  const uses = item?.system?.uses ?? {};
  const max = Number(uses?.max ?? 0);
  const value = Number(uses?.value ?? 0);
  if (!Number.isFinite(max) || max <= 0) return "";
  const v = Number.isFinite(value) ? value : 0;
  return `${v}`;
}

function mapItemButton(item) {
  const fullName = getItemName(item) || "";
  return {
    id: item.id,
    name: fullName,
    icon: item.img,
    usesText: formatItemUses(item)
  };
}

export function groupItemsByType(items, priority = "weapon") {
  const buckets = new Map();
  for (const it of items) {
    const type = it?.type ?? "other";
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(it);
  }

  const knownOrder = ["weapon", "consumable", "equipment", "tool", "loot", "backpack", "container"];
  const first = priority === "consumable" ? "consumable" : "weapon";
  const second = first === "weapon" ? "consumable" : "weapon";
  const order = [first, second, ...knownOrder.filter((k) => k !== first && k !== second)];

  const extraTypes = [...buckets.keys()]
    .filter((k) => !order.includes(k))
    .sort((a, b) => String(a).localeCompare(String(b), "zh"));

  const finalOrder = [...order, ...extraTypes];
  const sections = [];
  for (const type of finalOrder) {
    const list = buckets.get(type) ?? [];
    if (!list.length) continue;
    const mapped = list
      .slice()
      .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
      .map(mapItemButton);
    sections.push({ title: TYPE_TITLES[type] ?? type, items: mapped });
  }
  return sections;
}

function normalizeActivationType(item) {
  const t = item?.system?.activation?.type;
  if (t === "action") return "action";
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  return "other";
}

export function groupItemsByUseTime(items) {
  const order = ["action", "bonus", "reaction", "other"];
  const titles = {
    action: "动作",
    bonus: "附赠动作",
    reaction: "反应",
    other: "其他"
  };

  const buckets = new Map(order.map((k) => [k, []]));
  for (const it of items) {
    const key = normalizeActivationType(it);
    buckets.get(key)?.push(it);
  }

  const sections = [];
  for (const key of order) {
    const list = buckets.get(key) ?? [];
    if (!list.length) continue;
    const mapped = list
      .slice()
      .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
      .map(mapItemButton);
    sections.push({ title: titles[key] ?? "其他", items: mapped });
  }
  return sections;
}
