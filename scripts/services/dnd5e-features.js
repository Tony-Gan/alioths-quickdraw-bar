import { getItemName } from "./dnd5e-item-use.js";

export function getActorFeatureItemDocuments(actor) {
  if (!actor) return [];
  const list = (actor.items?.contents ?? actor.items ?? []);
  return list.filter((i) => i && i.type === "feat") ?? [];
}

function formatFeatureUses(item) {
  const uses = item?.system?.uses ?? {};
  const max = Number(uses?.max ?? 0);
  const value = Number(uses?.value ?? 0);
  if (!Number.isFinite(max) || max <= 0) return "";
  const v = Number.isFinite(value) ? value : 0;
  return `${v}`;
}

function getFirstItemActivity(item) {
  const activities = item?.activities ?? item?.system?.activities;
  if (!activities) return null;
  if (Array.isArray(activities)) return activities[0] ?? null;
  if (Array.isArray(activities?.contents)) return activities.contents[0] ?? null;
  if (typeof activities?.values === "function") {
    const it = activities.values();
    return it?.next?.().value ?? null;
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
}

function hasAnyItemActivity(item) {
  return Boolean(getFirstItemActivity(item));
}

function normalizeActivationType(item) {
  const firstActivity = getFirstItemActivity(item);
  if (!firstActivity) return "other";
  const t = (firstActivity?.activation?.type ?? firstActivity?.system?.activation?.type ?? "").toString().toLowerCase();
  if (t === "action") return "action";
  if (t === "bonus") return "bonus";
  if (t === "reaction") return "reaction";
  if (t.includes("legendary")) return "legendary";
  return "other";
}

function mapFeatureButton(item) {
  const displayName = getItemName(item) || "";
  return {
    id: item.id,
    name: displayName,
    icon: item.img,
    usesText: formatFeatureUses(item),
    activationType: normalizeActivationType(item),
    autoHidden: !hasAnyItemActivity(item)
  };
}

export function groupFeatureButtonsByUseTime(featureButtons) {
  const order = ["action", "bonus", "reaction", "legendary", "other"];
  const titles = {
    action: "动作",
    bonus: "附赠动作",
    reaction: "反应",
    legendary: "传奇动作",
    other: "其他"
  };

  const buckets = new Map(order.map((k) => [k, []]));
  for (const f of (featureButtons ?? [])) {
    const key = order.includes(f?.activationType) ? f.activationType : "other";
    buckets.get(key)?.push(f);
  }

  const sections = [];
  for (const key of order) {
    const list = buckets.get(key) ?? [];
    if (!list.length) continue;
    const items = list
      .slice()
      .sort((a, b) => (a?.name ?? "").localeCompare((b?.name ?? ""), "zh"));
    sections.push({ key: `time:${key}`, title: titles[key] ?? "其他", items });
  }
  return sections;
}

export function getActorFeatureButtons(actor) {
  const feats = getActorFeatureItemDocuments(actor);
  return (feats ?? [])
    .slice()
    .sort((a, b) => (getItemName(a) ?? "").localeCompare(getItemName(b) ?? "", "zh"))
    .map(mapFeatureButton);
}
